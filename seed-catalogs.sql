-- =============================================================================
-- RUTA U - SEED DATA PARA UNIVERSIDADES, CAMPUS, DOMINIOS Y ZONAS
-- Compatible con PostgreSQL / TablePlus
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. UNIVERSIDADES
-- -----------------------------------------------------------------------------
INSERT INTO universities (id, name, active)
VALUES
  ('10000000-0000-4000-8000-000000000002', 'Universidad del Valle de Guatemala (UVG)', true),
  ('10000000-0000-4000-8000-000000000003', 'Universidad de San Carlos de Guatemala (USAC)', true),
  ('10000000-0000-4000-8000-000000000004', 'Universidad Rafael Landívar (URL)', true),
  ('10000000-0000-4000-8000-000000000005', 'Universidad Francisco Marroquín (UFM)', true),
  ('10000000-0000-4000-8000-000000000006', 'Universidad del Istmo (UNIS)', true),
  ('10000000-0000-4000-8000-000000000007', 'Universidad Mariano Gálvez (UMG)', true),
  ('10000000-0000-4000-8000-000000000008', 'Universidad Galileo', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = true;

-- -----------------------------------------------------------------------------
-- 2. DOMINIOS INSTITUCIONALES APROBADOS
-- -----------------------------------------------------------------------------
INSERT INTO university_email_domains (university_id, domain, active)
VALUES
  -- UVG
  ('10000000-0000-4000-8000-000000000002', 'uvg.edu.gt', true),
  ('10000000-0000-4000-8000-000000000002', 'estudiantes.uvg.edu.gt', true),
  ('10000000-0000-4000-8000-000000000002', 'gmail.com', true),
  -- USAC
  ('10000000-0000-4000-8000-000000000003', 'usac.edu.gt', true),
  ('10000000-0000-4000-8000-000000000003', 'profesor.usac.edu.gt', true),
  ('10000000-0000-4000-8000-000000000003', 'ingenieria.usac.edu.gt', true),
  -- URL
  ('10000000-0000-4000-8000-000000000004', 'url.edu.gt', true),
  ('10000000-0000-4000-8000-000000000004', 'correo.url.edu.gt', true),
  -- UFM
  ('10000000-0000-4000-8000-000000000005', 'ufm.edu', true),
  -- UNIS
  ('10000000-0000-4000-8000-000000000006', 'unis.edu.gt', true),
  -- UMG
  ('10000000-0000-4000-8000-000000000007', 'umg.edu.gt', true),
  ('10000000-0000-4000-8000-000000000007', 'miumg.edu.gt', true),
  -- Galileo
  ('10000000-0000-4000-8000-000000000008', 'galileo.edu', true)
ON CONFLICT (university_id, domain) DO UPDATE SET active = true;

-- -----------------------------------------------------------------------------
-- 3. CAMPUS UNIVERSITARIOS
-- -----------------------------------------------------------------------------
INSERT INTO campuses (id, university_id, name, active)
VALUES
  -- UVG
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Campus Central (Zona 15)', true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Campus Sur (Santa Lucía Cotzumalguapa)', true),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Campus Altiplano (Sololá)', true),
  -- USAC
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'Ciudad Universitaria (Zona 12)', true),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'CUM - Centro Universitario Metropolitano (Zona 11)', true),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'CUNOC (Quetzaltenango)', true),
  -- URL
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'Campus Central (Zona 16)', true),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000004', 'Campus San Alberto Hurtado (Quetzaltenango)', true),
  -- UFM
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000005', 'Campus Central (Zona 10)', true),
  -- UNIS
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000006', 'Campus Fraijanes', true),
  -- UMG
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000007', 'Campus Central (Zona 2)', true),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000007', 'Campus Naranjo (Mixco)', true),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000007', 'Campus Portales (Zona 17)', true),
  -- Galileo
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000008', 'Campus Central (Zona 10)', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, university_id = EXCLUDED.university_id, active = true;

-- -----------------------------------------------------------------------------
-- 4. ZONAS (Área Metropolitana de Guatemala)
-- -----------------------------------------------------------------------------
INSERT INTO zones (name, municipality, department, active)
VALUES
  ('Zona 1 (Centro Histórico)', 'Guatemala', 'Guatemala', true),
  ('Zona 2 (Ciudad Nueva)', 'Guatemala', 'Guatemala', true),
  ('Zona 4 (Cuatro Grados Norte)', 'Guatemala', 'Guatemala', true),
  ('Zona 5', 'Guatemala', 'Guatemala', true),
  ('Zona 7 (Kaminaljuyú / Landívar)', 'Guatemala', 'Guatemala', true),
  ('Zona 9 (Plaza España)', 'Guatemala', 'Guatemala', true),
  ('Zona 10 (Zona Viva)', 'Guatemala', 'Guatemala', true),
  ('Zona 11 (Mariscal / Roosevelt)', 'Guatemala', 'Guatemala', true),
  ('Zona 12 (Reforma / USAC)', 'Guatemala', 'Guatemala', true),
  ('Zona 13 (La Aurora)', 'Guatemala', 'Guatemala', true),
  ('Zona 14 (La Cañada)', 'Guatemala', 'Guatemala', true),
  ('Zona 15 (Vista Hermosa / UVG)', 'Guatemala', 'Guatemala', true),
  ('Zona 16 (San Isidro / URL)', 'Guatemala', 'Guatemala', true),
  ('Zona 17 (Lomas del Norte)', 'Guatemala', 'Guatemala', true),
  ('Zona 18', 'Guatemala', 'Guatemala', true),
  ('Zona 21 (Justo Rufino Barrios)', 'Guatemala', 'Guatemala', true),
  ('Mixco - San Cristóbal', 'Mixco', 'Guatemala', true),
  ('Mixco - El Naranjo', 'Mixco', 'Guatemala', true),
  ('Mixco - Bosques de San Nicolás', 'Mixco', 'Guatemala', true),
  ('Santa Catarina Pinula - Carretera a El Salvador', 'Santa Catarina Pinula', 'Guatemala', true),
  ('Fraijanes - Carretera a El Salvador', 'Fraijanes', 'Guatemala', true),
  ('Villa Nueva - Centro / El Frutal', 'Villa Nueva', 'Guatemala', true)
ON CONFLICT (name, municipality, department) DO UPDATE SET active = true;

COMMIT;
