const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configuración de conexión (Asegúrate de que la URL sea la 'External' de Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://tagme_fdr1_user:7RFsW3DfEL3zl81FkYZ7lcGZyWXeC8s1@dpg-d7kdum8sfn5c73877p8g-a.oregon-postgres.render.com/tagme_fdr1',
    ssl: { rejectUnauthorized: false }
});

const BASE_URL_FRONTEND = 'https://dh31mus.github.io/TAGMe';

// --- ENDPOINT GUARDAR (POST) ---
app.post('/api/crear-perfil', upload.single('foto_perfil'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { 
            nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono,
            institucion, carrera, matricula, semestre, modalidad,
            correo, facebook, instagram, linkedin,
            ocupacion, aptitud1, aptitud2
        } = req.body;

        let fotoString = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : "";

        // 1. Insertar en datos_personales
        const resPersona = await client.query(
            `INSERT INTO datos_personales (nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono, foto_perfil) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_persona`,
            [nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono, fotoString]
        );
        const idPersona = resPersona.rows[0].id_persona;

        // 2. Insertar en datos_escolares
        await client.query(
            `INSERT INTO datos_escolares (id_persona, institucion, carrera, matricula, semestre, modalidad) VALUES ($1, $2, $3, $4, $5, $6)`,
            [idPersona, institucion, carrera, matricula, semestre, modalidad]
        );

        // 3. Insertar en medios_contacto
        await client.query(
            `INSERT INTO medios_contacto (id_persona, correo_electronico, link_facebook, link_instagram, link_linkedin) VALUES ($1, $2, $3, $4, $5)`,
            [idPersona, correo, facebook, instagram, linkedin]
        );

        // 4. Insertar en personalidad (Nueva tabla en 4NF)
        await client.query(
            `INSERT INTO personalidad (id_persona, ocupacion) VALUES ($1, $2)`,
            [idPersona, ocupacion]
        );

        // 5. Insertar en aptitudes_persona (Cumpliendo 4NF)
        if (aptitud1) {
            await client.query(`INSERT INTO aptitudes_persona (id_persona, aptitud_descripcion) VALUES ($1, $2)`, [idPersona, aptitud1]);
        }
        if (aptitud2) {
            await client.query(`INSERT INTO aptitudes_persona (id_persona, aptitud_descripcion) VALUES ($1, $2)`, [idPersona, aptitud2]);
        }

        // 6. Historial
        const urlFinal = `${BASE_URL_FRONTEND}/index.html?id=${idPersona}`;
        await client.query(`INSERT INTO historial_tarjetas (id_persona, url_generada) VALUES ($1, $2)`, [idPersona, urlFinal]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Perfil creado con éxito', id: idPersona, url: urlFinal });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("ERROR EN POST:", e.message);
        res.status(500).json({ error: 'Error al guardar: ' + e.message });
    } finally {
        client.release();
    }
});

// --- ENDPOINT LEER (GET) ---
app.get('/api/perfil/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        // Query corregida para 4NF: Agregamos las aptitudes como un array de strings
        const query = `
            SELECT 
                dp.*, de.institucion, de.matricula, de.carrera, de.semestre, de.modalidad,
                mc.correo_electronico, mc.link_facebook, mc.link_instagram, mc.link_linkedin,
                p.ocupacion,
                (SELECT json_agg(aptitud_descripcion) FROM aptitudes_persona WHERE id_persona = dp.id_persona) as aptitudes
            FROM datos_personales dp
            LEFT JOIN datos_escolares de ON dp.id_persona = de.id_persona
            LEFT JOIN medios_contacto mc ON dp.id_persona = mc.id_persona
            LEFT JOIN personalidad p ON dp.id_persona = p.id_persona
            WHERE dp.id_persona = $1
        `;
        const result = await client.query(query, [id]);
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Perfil no encontrado' });
        }
    } catch (e) {
        console.error("ERROR EN GET:", e.message);
        res.status(500).json({ error: 'Error al obtener datos' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor corriendo en puerto ${PORT}`); });