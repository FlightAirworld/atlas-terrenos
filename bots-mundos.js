'use strict';
// Jugadores automáticos de los OTROS MUNDOS 🚀 (ver bots.js): uno por mundo (Luna, Marte, Mercurio, Venus, Júpiter, Saturno,
// Urano, Neptuno, Plutón y Prehistoria), cada uno con su apodo y su bandera, distintos entre sí y distintos de los de la Tierra.
// Igual que los de la Tierra, reclaman UNA parcela al día, a una hora distinta cada día, sin cuenta (no cobran ni gastan créditos).
//
// En vez de municipios usan «centros»: el punto de aterrizaje del cohete y los lugares con nombre de ese mundo (los mismos que
// dibuja mundos.js), y reclaman a como mucho `spread` grados de uno de ellos, para que los jugadores los vean al llegar.
// Cada centro: [nombre, longitud, latitud].
// En Prehistoria los centros salen de prehistoria-terreno.js y nunca se reclama bajo el agua (lo comprueba el servidor).
const PT = require('./prehistoria-terreno.js');
const TZ = process.env.DAILY_TZ || 'Europe/Madrid';   // la franja horaria de reclamar (08:00-22:00) es la del juego, como el resto de tareas diarias

module.exports = [
  { id: 'mundo-luna', world: 'luna', cc: 'US', name: 'Moonboy', avatar: '🌟', tz: TZ, spread: 0.02, centers: [
    ['Mar de la Tranquilidad', 23.47, 0.67], ['Apolo 12', -23.4219, -3.0128], ['Apolo 14', -17.4714, -3.6453],
    ['Apolo 15', 3.6339, 26.1322], ['Apolo 16', 15.5002, -8.9730], ['Apolo 17', 30.7717, 20.1908]] },
  { id: 'mundo-marte', world: 'marte', cc: 'CN', name: 'Xiao Hong', avatar: '🚀', tz: TZ, spread: 0.02, centers: [
    ['Cráter Jezero', 77.45, 18.44], ['Viking 1', -47.95, 22.27], ['Viking 2', 134.26, 47.67], ['Pathfinder', -33.22, 19.13],
    ['Spirit', 175.47, -14.57], ['Opportunity', -5.53, -1.95], ['Curiosity', 137.44, -4.59], ['Phoenix', -125.7, 68.22],
    ['InSight', 135.62, 4.5], ['Zhurong', 109.93, 25.07]] },
  { id: 'mundo-mercurio', world: 'mercurio', cc: 'IT', name: 'Ermes', avatar: '😎', tz: TZ, spread: 0.02, centers: [
    ['Caloris Planitia', 162, 31], ['Cráter Rembrandt', 88, -33]] },
  { id: 'mundo-venus', world: 'venus', cc: 'FR', name: 'Cupidon', avatar: '👑', tz: TZ, spread: 0.02, centers: [
    ['Maat Mons', -165.5, 0.5], ['Maxwell Montes', 3, 65]] },
  { id: 'mundo-jupiter', world: 'jupiter', cc: 'GR', name: 'Zeus', avatar: '🦁', tz: TZ, spread: 0.02, centers: [
    ['Gran Mancha Roja', 20, -22]] },
  { id: 'mundo-saturno', world: 'saturno', cc: 'NL', name: 'Huygens', avatar: '🐼', tz: TZ, spread: 0.02, centers: [
    ['Anillos', 0, 10], ['Tormenta del norte', 40, 60]] },
  { id: 'mundo-urano', world: 'urano', cc: 'DE', name: 'Herschel', avatar: '🤠', tz: TZ, spread: 0.02, centers: [
    ['Ecuador', 0, 0], ['Polo (eje tumbado)', 0, 70]] },
  { id: 'mundo-neptuno', world: 'neptuno', cc: 'NO', name: 'Triton', avatar: '🐱', tz: TZ, spread: 0.02, centers: [
    ['Gran Mancha Oscura', -60, -22]] },
  { id: 'mundo-pluton', world: 'pluton', cc: 'MX', name: 'Plutoncito', avatar: '🐶', tz: TZ, spread: 0.02, centers: [
    ['Corazón de Plutón', 165, 22], ['Sputnik Planitia', 178, 25], ['Tombaugh Regio', 150, 22], ['Cthulhu Macula', 95, -15]] },
  { id: 'mundo-prehistoria', world: 'prehistoria', cc: 'AR', name: 'Dino', avatar: '🦊', tz: TZ, spread: 0.025,
    centers: [['Aterrizaje', PT.LAND[0], PT.LAND[1]]].concat(PT.SITES) },
];
