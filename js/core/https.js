/**
 * https.js — redirect HTTP to HTTPS on the client side as a belt-and-suspenders
 * measure. The backend already does a 308 server-side; this covers direct navigation
 * to the frontend (Firebase Hosting) which always serves HTTPS anyway, but this guards
 * against misconfigured proxies or local dev with wrong protocol.
 */
if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  location.replace('https:' + location.href.slice(location.protocol.length));
}
