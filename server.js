const express = require("express");
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const STREAM_BASE_URL = process.env.STREAM_BASE_URL || "http://10.0.2.2:8080/live";

let cameras = [];
let nextId = 1;

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "JadyCam API" });
});

app.get("/api/cameras", (req, res) => {
  res.json(cameras);
});

app.post("/api/cameras/bind", (req, res) => {
  const { stream_key, name, location, wifi_ssid } = req.body;

  if (!stream_key || !String(stream_key).trim()) {
    return res.status(400).json({ message: "El stream_key es obligatorio." });
  }

  const cleanKey = String(stream_key).trim();
  let camera = cameras.find((c) => c.StreamKey === cleanKey);

  if (!camera) {
    camera = {
      Id: nextId++,
      StreamKey: cleanKey,
      Name: name && String(name).trim() ? String(name).trim() : `Cámara ${cleanKey}`,
      Location: location && String(location).trim() ? String(location).trim() : "Sin ubicación",
      WifiSsid: wifi_ssid && String(wifi_ssid).trim() ? String(wifi_ssid).trim() : null,
      AnchoredAt: wifi_ssid && String(wifi_ssid).trim() ? new Date().toISOString() : null,
      StreamUrl: `${STREAM_BASE_URL}/${cleanKey}/index.m3u8`
    };
    cameras.push(camera);
  } else if (wifi_ssid && String(wifi_ssid).trim()) {
    camera.WifiSsid = String(wifi_ssid).trim();
    camera.AnchoredAt = new Date().toISOString();
  }

  res.status(200).json({
    message: "Cámara vinculada correctamente",
    camera
  });
});

app.post("/api/cameras/anchor", (req, res) => {
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
  const camera = cameras.find((c) => c.StreamKey === cleanKey);

  if (!camera) {
    return res.status(404).json({ message: "No se encontró la cámara especificada." });
  }

  camera.WifiSsid = String(wifi_ssid).trim();
  camera.AnchoredAt = new Date().toISOString();

  return res.status(200).json({
    message: `Cámara anclada a ${camera.WifiSsid}`,
    camera
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor JadyCam API escuchando en puerto ${PORT}`);
});