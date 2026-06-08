// services/alertService.js
function broadcastAlert(io, alertData) {
  io.to("alert_room").emit("new_alert", alertData);
}

function broadcastMetrics(io, metrics) {
  io.emit("model_metrics", metrics);
}

module.exports = { broadcastAlert, broadcastMetrics };