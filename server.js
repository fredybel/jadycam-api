require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar Firebase Admin desde variable de entorno FIREBASE_SERVICE_ACCOUNT
if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    console.error("Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT");
    process.exit(1);
  }
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const camerasCollection = db.collection("cameras");

const PORT = process.env.PORT || 3000;
const STREAM_BASE_URL = process.env.STREAM_BASE_URL || "https://tu-servidor-stream.com/live";

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "JadyCam API (Firestore)" });
});

// Obtener todas las cámaras guardadas en Firestore
app.get("/api/cameras", async (req, res) => {
  try {
    const snapshot = await camerasCollection.orderBy("Id", "asc").get();
    const cameras = snapshot.docs.map((doc) => doc.data());
    res.json(cameras);
  } catch (error) {
    console.error("Error obteniendo cámaras:", error);
    res.status(500).json({ message: "Error al obtener las cámaras." });
  }
});

// Vincular o registrar una cámara
app.post("/api/cameras/bind", async (req, res) => {
  try {
    const { stream_key, name, location, wifi_ssid } = req.body;

    if (!stream_key || !String(stream_key).trim()) {
      return res.status(400).json({ message: "El stream_key es obligatorio." });
    }

    const cleanKey = String(stream_key).trim();
    const docRef = camerasCollection.doc(cleanKey);
    const docSnap = await docRef.get();

    let camera;

    if (!docSnap.exists) {
      const countSnap = await camerasCollection.count().get();
      const nextId = (countSnap.data().count || 0) + 1;

      camera = {
        Id: nextId,
        StreamKey: cleanKey,
        Name: name && String(name).trim() ? String(name).trim() : `Cámara ${cleanKey}`,
        Location: location && String(location).trim() ? String(location).trim() : "Sin ubicación",
        WifiSsid: wifi_ssid && String(wifi_ssid).trim() ? String(wifi_ssid).trim() : null,
        AnchoredAt: wifi_ssid && String(wifi_ssid).trim() ? new Date().toISOString() : null,
        StreamUrl: `${STREAM_BASE_URL}/${cleanKey}/index.m3u8`
      };

      await docRef.set(camera);
    } else {
      camera = docSnap.data();
      if (wifi_ssid && String(wifi_ssid).trim()) {
        camera.WifiSsid = String(wifi_ssid).trim();
        camera.AnchoredAt = new Date().toISOString();
        await docRef.update({
          WifiSsid: camera.WifiSsid,
          AnchoredAt: camera.AnchoredAt
        });
      }
    }

    res.status(200).json({
      message: "Cámara vinculada correctamente",
      camera
    });
  } catch (error) {
    console.error("Error vinculando cámara:", error);
    res.status(500).json({ message: "Error interno al vincular la cámara." });
  }
});

// Anclar una cámara existente a una red Wi-Fi con clave
app.post("/api/cameras/anchor", async (req, res) => {
  try {
    const { stream_key, wifi_ssid, key } = req.body;

    if (!stream_key || !String(stream_key).trim()) {
      return res.status(400).json({ message: "Falta el identificador de la cámara (stream_key)." });
    }
    if (!wifi_ssid || !String(wifi_ssid).trim()) {
      return res.status(400).json({ message: "Debes indicar la red a la que se anclará la cámara." });
    }
    if (!key || !String(key).trim()) {
      return res.status(400).json({ message: "Debes ingresar una clave." });
    }

    const cleanKey = String(stream_key).trim();
    const docRef = camerasCollection.doc(cleanKey);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "No se encontró la cámara especificada." });
    }

    const updatedFields = {
      WifiSsid: String(wifi_ssid).trim(),
      AnchoredAt: new Date().toISOString()
    };

    await docRef.update(updatedFields);

    const camera = { ...docSnap.data(), ...updatedFields };

    return res.status(200).json({
      message: `Cámara anclada a ${camera.WifiSsid}`,
      camera
    });
  } catch (error) {
    console.error("Error anclando cámara:", error);
    return res.status(500).json({ message: "Error interno al anclar la cámara." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor JadyCam API con Firestore escuchando en puerto ${PORT}`);
});