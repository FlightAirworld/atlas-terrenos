// Atlas Terrenos — servidor sin dependencias (Node >= 22.5, usa node:sqlite)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// ---------- Configuración ----------
const PORT = Number(process.env.PORT || 3000);
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase(); // sandbox | live
const PAYPAL_BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PRICE = (process.env.PRICE || '1.00');              // precio por parcela
const CURRENCY = (process.env.CURRENCY || 'EUR').toUpperCase();
const DEMO = !(PAYPAL_CLIENT_ID && PAYPAL_SECRET) || process.env.DEMO === '1';
const RESERVE_MINUTES = 10;                               // tiempo que se reserva una parcela mientras se paga
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'terrenos.db');

// Rejilla del mundo: cada parcela es un cuadrado de 0.001° (~111 m de lado en latitud)
const SIZE = 0.0005;
const MAX_X = Math.round(360 / SIZE);   // 360000 columnas
const MAX_Y = Math.round(180 / SIZE);   // 180000 filas

// ---------- Base de datos ----------
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS parcels (
    id TEXT PRIMARY KEY,            -- "x:y"  (clave única: una parcela solo se vende una vez)
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    owner TEXT NOT NULL,
