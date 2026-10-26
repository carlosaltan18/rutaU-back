import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://rutau_bd_user:E4nZuonaI39S08acWPGdoIZ0IICdos9X@dpg-db6ri10n74is738ofgbg-a.oregon-postgres.render.com/rutau_bd',
  ssl: { rejectUnauthorized: false }
});

const universities = [
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Universidad del Valle de Guatemala (UVG)',
    domains: ['uvg.edu.gt', 'estudiantes.uvg.edu.gt', 'gmail.com'],
    campuses: [
      { id: '20000000-0000-4000-8000-000000000002', name: 'Campus Central (Zona 15)' },
      { id: '20000000-0000-4000-8000-000000000003', name: 'Campus Sur (Santa Lucía Cotzumalguapa)' },
      { id: '20000000-0000-4000-8000-000000000004', name: 'Campus Altiplano (Sololá)' }
    ]
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Universidad de San Carlos de Guatemala (USAC)',
    domains: ['usac.edu.gt', 'profesor.usac.edu.gt', 'ingenieria.usac.edu.gt'],
    campuses: [
      { id: '20000000-0000-4000-8000-000000000005', name: 'Ciudad Universitaria (Zona 12)' },
      { id: '20000000-0000-4000-8000-000000000006', name: 'CUM - Centro Universitario Metropolitano (Zona 11)' },
      { id: '20000000-0000-4000-8000-000000000007', name: 'CUNOC (Quetzaltenango)' }
    ]
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'Universidad Rafael Landívar (URL)',
    domains: ['url.edu.gt', 'correo.url.edu.gt'],
    campuses: [
      { id: '20000000-0000-4000-8000-000000000008', name: 'Campus Central (Zona 16)' },
      { id: '20000000-0000-4000-8000-000000000009', name: 'Campus San Alberto Hurtado (Quetzaltenango)' }
    ]
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    name: 'Universidad Francisco Marroquín (UFM)',
    domains: ['ufm.edu'],
    campuses: [
      { id: '20000000-0000-4000-8000-000000000010', name: 'Campus Central (Zona 10)' }
    ]
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    name: 'Universidad del Istmo (UNIS)',
    domains: ['unis.edu.gt'],
    campuses: [
      { id: '20000000-0000-4000-8000-000000000011', name: 'Campus Fraijanes' }
    ]
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    name: 'Universidad Mariano Gálvez (UMG)',
    domains: ['umg.edu.gt', 'miumg.edu.gt'],
    campuses: [
      { id: '20000000-0000-4000-8000-000000000012', name: 'Campus Central (Zona 2)' },
      { id: '20000000-0000-4000-8000-000000000013', name: 'Campus Naranjo (Mixco)' },
      { id: '20000000-0000-4000-8000-000000000014', name: 'Campus Portales (Zona 17)' }
    ]
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    name: 'Universidad Galileo',
    domains: ['galileo.edu'],
    campuses: [
      { id: '20000000-0000-4000-8000-000000000015', name: 'Campus Central (Zona 10)' }
    ]
  }
];

const zones = [
  { name: 'Zona 1 (Centro Histórico)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 2 (Ciudad Nueva)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 4 (Cuatro Grados Norte)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 5', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 7 (Kaminaljuyú / Landívar)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 9 (Plaza España)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 10 (Zona Viva)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 11 (Mariscal / Roosevelt)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 12 (Reforma / USAC)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 13 (La Aurora)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 14 (La Cañada)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 15 (Vista Hermosa / UVG)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 16 (San Isidro / URL)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 17 (Lomas del Norte)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 18', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Zona 21 (Justo Rufino Barrios)', municipality: 'Guatemala', department: 'Guatemala' },
  { name: 'Mixco - San Cristóbal', municipality: 'Mixco', department: 'Guatemala' },
  { name: 'Mixco - El Naranjo', municipality: 'Mixco', department: 'Guatemala' },
  { name: 'Mixco - Bosques de San Nicolás', municipality: 'Mixco', department: 'Guatemala' },
  { name: 'Santa Catarina Pinula - Carretera a El Salvador', municipality: 'Santa Catarina Pinula', department: 'Guatemala' },
  { name: 'Fraijanes - Carretera a El Salvador', municipality: 'Fraijanes', department: 'Guatemala' },
  { name: 'Villa Nueva - Centro / El Frutal', municipality: 'Villa Nueva', department: 'Guatemala' }
];

async function run() {
  await client.connect();
  console.log('Connected to Render PostgreSQL database.');

  await client.query('BEGIN');
  try {
    for (const u of universities) {
      await client.query(
        `INSERT INTO universities (id, name, active)
         VALUES ($1, $2, true)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = true`,
        [u.id, u.name]
      );

      for (const domain of u.domains) {
        await client.query(
          `INSERT INTO university_email_domains (university_id, domain, active)
           VALUES ($1, $2, true)
           ON CONFLICT (university_id, domain) DO UPDATE SET active = true`,
          [u.id, domain]
        );
      }

      for (const c of u.campuses) {
        await client.query(
          `INSERT INTO campuses (id, university_id, name, active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, university_id = EXCLUDED.university_id, active = true`,
          [c.id, u.id, c.name]
        );
      }
    }

    for (const z of zones) {
      await client.query(
        `INSERT INTO zones (name, municipality, department, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name, municipality, department) DO UPDATE SET active = true`,
        [z.name, z.municipality, z.department]
      );
    }

    await client.query('COMMIT');
    console.log('Successfully committed catalogs!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding catalogs:', err);
    throw err;
  } finally {
    const uCount = await client.query('SELECT count(*) FROM universities');
    const cCount = await client.query('SELECT count(*) FROM campuses');
    const zCount = await client.query('SELECT count(*) FROM zones');
    const dCount = await client.query('SELECT count(*) FROM university_email_domains');
    console.log(`Current counts in DB -> Universities: ${uCount.rows[0].count}, Campuses: ${cCount.rows[0].count}, Zones: ${zCount.rows[0].count}, Domains: ${dCount.rows[0].count}`);
    await client.end();
  }
}

run().catch(console.error);
