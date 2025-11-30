const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');   // <--- Módulo para manejar archivos
const path = require('path'); // <--- Módulo para manejar rutas

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configura tu conexión a PostgreSQL (Híbrida: Nube y Local)

const pool = new Pool({
    // Aquí le decimos: "Usa la variable de la nube, o si no hay, usa mi local"
    user: 'postgres',           // <--- Usualmente es 'postgres'
    host: 'localhost',
    database: 'PerfilEstudiante', // <--- El nombre exacto de la base de datos donde corriste el script SQL
    password: 'DH31',     // <--- La contraseña que creaste al instalar PostgreSQL
    port: 5432,
    connectionString: process.env.DATABASE_URL || 'postgresql://tagme_user:1hJHZUnPwnAXMy9Jwhi2HO7SJ0QkyG9Y@dpg-d4ljv0muk2gs738f3vl0-a/tagme',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// TU URL BASE (Cambia esto si tu repo de GitHub cambia de nombre)
// Esto es necesario para armar el link completo
const BASE_URL_FRONTEND = 'https://dh31mus.github.io/TAGMe'; 

// Endpoint para GUARDAR (POST)
app.post('/api/crear-perfil', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { 
            nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono, foto_perfil,
            institucion, carrera, matricula, semestre,
            correo, facebook, instagram, linkedin,
            ocupacion, aptitud1, aptitud2
        } = req.body;

        // 1. Insertar Persona
        const resPersona = await client.query(
            `INSERT INTO datos_personales (nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono, foto_perfil) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_persona`,
            [nombre_completo, fecha_nacimiento, telefono, contacto_emergencia_nombre, contacto_emergencia_telefono, foto_perfil]
        );
        const idPersona = resPersona.rows[0].id_persona;

        // 2. Insertar Datos Escolares
        await client.query(
            `INSERT INTO datos_escolares (id_persona, institucion, carrera, matricula, semestre) VALUES ($1, $2, $3, $4, $5)`,
            [idPersona, institucion, carrera, matricula, semestre]
        );

        // 3. Insertar Medios de Contacto
        await client.query(
            `INSERT INTO medios_contacto (id_persona, correo_electronico, link_facebook, link_instagram, link_linkedin) VALUES ($1, $2, $3, $4, $5)`,
            [idPersona, correo, facebook, instagram, linkedin]
        );

        // 4. Insertar Personalidad
        await client.query(
            `INSERT INTO personalidad (id_persona, ocupacion, aptitud_1, aptitud_2) VALUES ($1, $2, $3, $4)`,
            [idPersona, ocupacion, aptitud1, aptitud2]
        );

        // --- NUEVA LÓGICA: URL Y ARCHIVO TXT ---

        // A) Construir la URL completa
        const urlFinal = `${BASE_URL_FRONTEND}/index.html?id=${idPersona}`;

        // B) Guardar en la Base de Datos (Tabla nueva)
        await client.query(
            `INSERT INTO historial_tarjetas (id_persona, url_generada) VALUES ($1, $2)`,
            [idPersona, urlFinal]
        );

        // C) Guardar en archivo TXT (Lista numerada usando el ID)
        const lineaTexto = `${idPersona}. ${urlFinal}\n`; // Ej: "1. https://.../index.html?id=1"
        const rutaArchivo = path.join(__dirname, 'lista_urls.txt');

        // AppendFile agrega al final sin borrar lo anterior
        fs.appendFile(rutaArchivo, lineaTexto, (err) => {
            if (err) console.error("Error al escribir en txt:", err);
            else console.log("URL guardada en lista_urls.txt");
        });

        // ----------------------------------------

        await client.query('COMMIT');
        res.status(201).json({ message: 'Perfil creado con éxito', id: idPersona, url: urlFinal });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ error: 'Error al guardar los datos: ' + e.message });
    } finally {
        client.release();
    }
});

// Endpoint para LEER (GET) - Sin cambios, solo lo incluyo para que tengas el archivo completo
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

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Perfil no encontrado' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al obtener datos' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});