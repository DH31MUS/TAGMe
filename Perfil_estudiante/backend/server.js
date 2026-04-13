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

const { Pool } = require('pg');

const pool = new Pool({
    // 1. Intentará usar la variable de entorno del servidor si existe.
    // 2. Si no existe (estás en tu PC), usará tu configuración local.
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:DH31@localhost:5432/PerfilEstudiante',
    
    // El SSL debe estar desactivado para conexiones locales de Postgres por defecto
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Prueba de conexión inicial (opcional pero recomendada)
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos local:', err.stack);
    } else {
        console.log('✅ Conexión exitosa a "PerfilEstudiante". Hora del servidor:', res.rows[0].now);
    }
});

// Endpoint GUARDAR (Ahora soporta archivos con upload.single)
app.post('/api/crear-perfil', upload.single('foto_perfil'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Los datos de texto vienen en req.body
        const { 
            nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono,
            institucion, carrera, matricula, semestre,
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
        await client.query(
            `INSERT INTO datos_escolares (id_persona, institucion, carrera, matricula, semestre) VALUES ($1, $2, $3, $4, $5)`,
            [idPersona, institucion, carrera, matricula, semestre]
        );

        await client.query(
            `INSERT INTO medios_contacto (id_persona, correo_electronico, link_facebook, link_instagram, link_linkedin) VALUES ($1, $2, $3, $4, $5)`,
            [idPersona, correo, facebook, instagram, linkedin]
        );

        await client.query(
            `INSERT INTO personalidad (id_persona, ocupacion, aptitud_1, aptitud_2) VALUES ($1, $2, $3, $4)`,
            [idPersona, ocupacion, aptitud1, aptitud2]
        );

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
                de.institucion, de.matricula, de.carrera, de.semestre,
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