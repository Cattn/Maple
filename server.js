import { handler } from './build/handler.js';
import express from 'express';
import path from 'path';
import * as fs from 'fs';
import http from 'node:http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

const server = http.createServer(app);

const uploadsPath = path.join(__dirname, 'SMS', 'uploads');
if (fs.existsSync(uploadsPath)) {
    app.use('/SMS/uploads', express.static(uploadsPath));
  
    app.use('/SMS/uploads', (req, res) => {
        res.status(404).send('404, no media found!');
    });
  
    app.use('/SMS/upload', (req, res) => {
      res.status(404).send('404, did you mean `/SMS/uploads`?');
    });
  }
  

// let SvelteKit handle everything else, including serving prerendered pages and static assets
app.use(handler);

server.listen(5000);