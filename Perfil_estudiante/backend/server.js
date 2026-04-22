const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
// const bodyParser = require('body-parser'); // YA NO ES NECESARIO CON MULTER/EXPRESS NUEVO
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // <--- LIBRERÍA NUEVA

const app = express();
app.use(cors());
app.use(express.json()); // Reemplazo moderno de body-parser

// Configuración de Multer (Procesar archivo en memoria RAM)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://tagme_fdr1_user:7RFsW3DfEL3zl81FkYZ7lcGZyWXeC8s1@dpg-d7kdum8sfn5c73877p8g-a.oregon-postgres.render.com/tagme_fdr1',
   ssl: { rejectUnauthorized: false }
});

const BASE_URL_FRONTEND = 'https://dh31mus.github.io/TAGMe'; 

// Endpoint GUARDAR (Ahora soporta archivos con upload.single)
app.post('/api/crear-perfil', upload.single('foto_perfil'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Los datos de texto vienen en req.body
        const { 
            nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono,
            institucion, carrera, matricula, semestre, modalidad, // Añadido 'modalidad'
            correo, facebook, instagram, linkedin,
            ocupacion, aptitud1, aptitud2
        } = req.body;

        // --- LÓGICA DE IMAGEN ---
        let fotoString = ""; 
        
        // Si el usuario subió un archivo, lo convertimos a Base64
        if (req.file) {
            const b64 = req.file.buffer.toString('base64');
            const mime = req.file.mimetype; // ej: image/jpeg
            fotoString = `data:${mime};base64,${b64}`;
        } else {
            // Si no subió nada, mandamos cadena vacía o null
            fotoString = ""; 
        }

        // INSERT Persona (Usamos fotoString en lugar de una URL manual)
        const resPersona = await client.query(
            `INSERT INTO datos_personales (nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono, foto_perfil) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_persona`,
            [nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono, fotoString]
        );
        const idPersona = resPersona.rows[0].id_persona;

        // INSERTS restantes (Igual que antes)
        await client.query( // Modificado para incluir 'modalidad'
            `INSERT INTO datos_escolares (id_persona, institucion, carrera, matricula, semestre, modalidad) VALUES ($1, $2, $3, $4, $5, $6)`,
            [idPersona, institucion, carrera, matricula, semestre, modalidad]
        );

        await client.query(
            `INSERT INTO medios_contacto (id_persona, correo_electronico, link_facebook, link_instagram, link_linkedin) VALUES ($1, $2, $3, $4, $5)`,
            [idPersona, correo, facebook, instagram, linkedin]
        );

        // Cambia "description" por "descripcion" (o como lo hayas puesto en DBeaver)
if (aptitud1) {
    await client.query(`INSERT INTO aptitudes_persona (id_persona, aptitud_descripcion) VALUES ($1, $2)`, [idPersona, aptitud1]);
}
if (aptitud2) {
    await client.query(`INSERT INTO aptitudes_persona (id_persona, aptitud_descripcion) VALUES ($1, $2)`, [idPersona, aptitud2]);
}

        // Historial y TXT
        const urlFinal = `${BASE_URL_FRONTEND}/index.html?id=${idPersona}`;
        await client.query(`INSERT INTO historial_tarjetas (id_persona, url_generada) VALUES ($1, $2)`, [idPersona, urlFinal]);
        
        // Txt (Solo funciona localmente o hasta reinicio de Render)
        /* const lineaTexto = `${idPersona}. ${urlFinal}\n`;
        const rutaArchivo = path.join(__dirname, 'lista_urls.txt');
        fs.appendFile(rutaArchivo, lineaTexto, (err) => { if (err) console.error(err); }); */

        await client.query('COMMIT');
        res.status(201).json({ message: 'Perfil creado con éxito', id: idPersona, url: urlFinal });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ error: 'Error al guardar: ' + e.message });
    } finally {
        client.release();
    }
});

// Endpoint LEER (Sin cambios necesarios)
app.get('/api/perfil/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                dp.nombre_completo, dp.fecha_nacimiento, dp.telefono, dp.contacto_emergencia_nombre, dp.contacto_emergencia_telefono, dp.foto_perfil,
                de.institucion, de.matricula, de.carrera, de.semestre, de.modalidad, -- Añadido de.modalidad
                mc.correo_electronico, mc.link_facebook, mc.link_instagram, mc.link_linkedin,
                p.ocupacion, p.aptitud_1, p.aptitud_2
            FROM datos_personales dp
            LEFT JOIN datos_escolares de ON dp.id_persona = de.id_persona
            LEFT JOIN medios_contacto mc ON dp.id_persona = mc.id_persona
            LEFT JOIN personalidad p ON dp.id_persona = p.id_persona
            WHERE dp.id_persona = $1
        `;
        const result = await client.query(query, [id]);
        if (result.rows.length > 0) res.json(result.rows[0]);
        else res.status(404).json({ error: 'Perfil no encontrado' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al obtener datos' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor corriendo en puerto ${PORT}`); });