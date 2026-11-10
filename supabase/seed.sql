-- =============================================================================
-- SakayWise DEMO SEED — GENERATED, DO NOT EDIT BY HAND.
-- Source: src/apps/commuter/data/* via scripts/generate-demo-seed.mjs
--
-- Every record below is FICTIONAL / ILLUSTRATIVE. Provenance columns say so:
--   provenance = 'illustrative-demo', fare verification_status = 'illustrative-sample',
--   advisory source_type = 'demo' + verification_status = 'simulated'.
-- Do not load this into a production project that serves real commuters.
-- No queue reports, support conversations or admin replies are seeded: community data
-- must come from real submissions, and fake admin messages are never created.
-- Advisory times are relative to now(); re-run this file to refresh the simulation.
-- Safe to re-run (upserts).
-- =============================================================================
begin;

-- Places
insert into public.transport_places (id, name, formatted_address, street, building, barangay, city, landmark, provenance, sort_order) values
  ('ust-frassati', 'UST Frassati (España)', 'España Boulevard, Sampaloc, Manila', 'España Boulevard', 'UST Blessed Pier Giorgio Frassati Building', 'Sampaloc', 'Manila', 'University of Santo Tomas', 'illustrative-demo', 0),
  ('sm-north', 'SM North EDSA / Annex', 'North Avenue corner EDSA, Bagong Pag-asa, Quezon City', 'North Avenue, EDSA', 'SM North EDSA Annex', 'Bagong Pag-asa', 'Quezon City', 'The Annex entrance', 'illustrative-demo', 1),
  ('pasay-rotonda', 'Pasay Rotonda', 'EDSA corner Taft Avenue, Pasay City', 'EDSA, Taft Avenue', null, null, 'Pasay City', 'MRT Taft Avenue Station', 'illustrative-demo', 2),
  ('one-ayala', 'One Ayala, Makati', 'Ayala Avenue corner EDSA, San Lorenzo, Makati City', 'Ayala Avenue, EDSA', 'One Ayala', 'San Lorenzo', 'Makati City', 'Ayala MRT Station', 'illustrative-demo', 3),
  ('pitx', 'PITX, Parañaque', 'Kennedy Road, Tambo, Parañaque City', 'Kennedy Road', 'Parañaque Integrated Terminal Exchange', 'Tambo', 'Parañaque City', 'PITX terminal', 'illustrative-demo', 4),
  ('sm-moa', 'SM Mall of Asia', 'Seaside Boulevard, Bay City, Pasay City', 'Seaside Boulevard', 'SM Mall of Asia', 'Bay City', 'Pasay City', 'MOA Globe, transport terminal', 'illustrative-demo', 5),
  ('gateway-cubao', 'Gateway Mall, Cubao', 'General Roxas Avenue, Socorro, Cubao, Quezon City', 'General Roxas Avenue', 'Gateway Mall', 'Socorro', 'Quezon City', 'Araneta City, LRT-2 Cubao', 'illustrative-demo', 6),
  ('manila-city-hall', 'Manila City Hall', 'Padre Burgos Avenue, Ermita, Manila', 'Padre Burgos Avenue', 'Manila City Hall', 'Ermita', 'Manila', 'Bonifacio and the Katipunan monument', 'illustrative-demo', 7),
  ('quezon-circle', 'Quezon Memorial Circle', 'Elliptical Road, Diliman, Quezon City', 'Elliptical Road', null, 'Diliman', 'Quezon City', 'Quezon Memorial Shrine', 'illustrative-demo', 8),
  ('marikina-sports', 'Marikina Sports Center', 'Sumulong Highway, Santo Niño, Marikina City', 'Sumulong Highway', 'Marikina Sports Center', 'Santo Niño', 'Marikina City', 'Marikina City Hall', 'illustrative-demo', 9),
  ('antipolo-cathedral', 'Antipolo Cathedral', 'P. Oliveros Street, San Roque, Antipolo City, Rizal', 'P. Oliveros Street', null, 'San Roque', 'Antipolo City', 'Our Lady of Peace and Good Voyage', 'illustrative-demo', 10),
  ('san-mateo-plaza', 'San Mateo Municipal Plaza', 'General Luna Avenue, Guitnang Bayan, San Mateo, Rizal', 'General Luna Avenue', null, 'Guitnang Bayan', 'San Mateo', 'Municipal hall', 'illustrative-demo', 11)
on conflict (id) do update set name = excluded.name, formatted_address = excluded.formatted_address, street = excluded.street, building = excluded.building, barangay = excluded.barangay, city = excluded.city, landmark = excluded.landmark, provenance = excluded.provenance, sort_order = excluded.sort_order;

-- Graph nodes (place endpoints use the place id as their own id)
insert into public.transport_stops (id, name, place_id, area_id, stop_type, provenance) values
  ('ust-frassati', 'UST Frassati (España)', 'ust-frassati', 'ust-frassati', 'place-endpoint', 'illustrative-demo'),
  ('sm-north', 'SM North EDSA / Annex', 'sm-north', 'sm-north', 'place-endpoint', 'illustrative-demo'),
  ('pasay-rotonda', 'Pasay Rotonda', 'pasay-rotonda', 'pasay-rotonda', 'place-endpoint', 'illustrative-demo'),
  ('one-ayala', 'One Ayala, Makati', 'one-ayala', 'one-ayala', 'place-endpoint', 'illustrative-demo'),
  ('pitx', 'PITX, Parañaque', 'pitx', 'pitx', 'place-endpoint', 'illustrative-demo'),
  ('sm-moa', 'SM Mall of Asia', 'sm-moa', 'sm-moa', 'place-endpoint', 'illustrative-demo'),
  ('gateway-cubao', 'Gateway Mall, Cubao', 'gateway-cubao', 'gateway-cubao', 'place-endpoint', 'illustrative-demo'),
  ('manila-city-hall', 'Manila City Hall', 'manila-city-hall', 'manila-city-hall', 'place-endpoint', 'illustrative-demo'),
  ('quezon-circle', 'Quezon Memorial Circle', 'quezon-circle', 'quezon-circle', 'place-endpoint', 'illustrative-demo'),
  ('marikina-sports', 'Marikina Sports Center', 'marikina-sports', 'marikina-sports', 'place-endpoint', 'illustrative-demo'),
  ('antipolo-cathedral', 'Antipolo Cathedral', 'antipolo-cathedral', 'antipolo-cathedral', 'place-endpoint', 'illustrative-demo'),
  ('san-mateo-plaza', 'San Mateo Municipal Plaza', 'san-mateo-plaza', 'san-mateo-plaza', 'place-endpoint', 'illustrative-demo'),
  ('ust-road', 'UST España sample boarding area', null, 'ust-frassati', 'boarding-area', 'illustrative-demo'),
  ('legarda', 'Legarda sample LRT platform', null, 'legarda', 'platform', 'illustrative-demo'),
  ('cubao-lrt', 'Cubao sample LRT drop-off', null, 'cubao', 'drop-off', 'illustrative-demo'),
  ('cubao-mrt', 'Cubao sample MRT platform', null, 'cubao', 'platform', 'illustrative-demo'),
  ('north-jeep', 'SM North sample jeepney drop-off', null, 'sm-north', 'drop-off', 'illustrative-demo'),
  ('north-uv', 'SM North sample UV drop-off', null, 'sm-north', 'drop-off', 'illustrative-demo'),
  ('north-mrt', 'North Avenue sample MRT exit', null, 'sm-north', 'drop-off', 'illustrative-demo'),
  ('pasay-road', 'Pasay Rotonda sample boarding area', null, 'pasay-rotonda', 'boarding-area', 'illustrative-demo'),
  ('taft-mrt', 'Taft sample MRT platform', null, 'pasay-rotonda', 'platform', 'illustrative-demo'),
  ('libertad', 'Libertad sample local stop', null, 'libertad', 'local-stop', 'illustrative-demo'),
  ('libertad-bus', 'Libertad sample bus boarding area', null, 'libertad', 'boarding-area', 'illustrative-demo'),
  ('moa-jeep', 'MOA sample modern jeepney stop', null, 'sm-moa', 'transfer-point', 'illustrative-demo'),
  ('moa-bus', 'MOA sample bus drop-off', null, 'sm-moa', 'drop-off', 'illustrative-demo'),
  ('ayala-road', 'One Ayala sample road terminal', null, 'one-ayala', 'boarding-area', 'illustrative-demo'),
  ('ayala-mrt', 'Ayala sample MRT platform', null, 'one-ayala', 'platform', 'illustrative-demo'),
  ('taft-bus', 'Taft sample PITX-bound bus stop', null, 'pasay-rotonda', 'boarding-area', 'illustrative-demo'),
  ('pitx-platform', 'PITX sample boarding / drop-off area', null, 'pitx', 'drop-off', 'illustrative-demo'),
  ('ust-taft', 'España sample Taft-bound bus stop', null, 'ust-frassati', 'boarding-area', 'illustrative-demo')
on conflict (id) do update set name = excluded.name, place_id = excluded.place_id, area_id = excluded.area_id, stop_type = excluded.stop_type, provenance = excluded.provenance;

-- Vehicle services (one per sample ride connection)
insert into public.transport_services (id, name, mode, provenance) values
  ('srv:ust-north-jeep', 'España–SM North jeepney', 'jeepney', 'illustrative-demo'),
  ('srv:ust-north-uv', 'España–SM North UV Express', 'uv', 'illustrative-demo'),
  ('srv:legarda-cubao', 'LRT sample eastbound leg', 'lrt', 'illustrative-demo'),
  ('srv:cubao-north', 'MRT sample northbound leg', 'mrt', 'illustrative-demo'),
  ('srv:pasay-moa-modern', 'Pasay–MOA modern jeepney', 'modern-jeepney', 'illustrative-demo'),
  ('srv:pasay-moa-bus', 'Pasay–MOA city bus', 'bus', 'illustrative-demo'),
  ('srv:pasay-libertad-tricycle', 'Sample local tricycle connection', 'tricycle', 'illustrative-demo'),
  ('srv:libertad-moa', 'Libertad–MOA sample bus', 'bus', 'illustrative-demo'),
  ('srv:ayala-pitx-bus', 'One Ayala–PITX city bus', 'bus', 'illustrative-demo'),
  ('srv:ayala-pitx-uv', 'One Ayala–PITX UV Express', 'uv', 'illustrative-demo'),
  ('srv:ayala-taft-mrt', 'MRT sample southbound leg', 'mrt', 'illustrative-demo'),
  ('srv:taft-pitx-bus', 'Taft–PITX sample bus', 'bus', 'illustrative-demo'),
  ('srv:taft-ayala-mrt', 'MRT sample northbound leg', 'mrt', 'illustrative-demo'),
  ('srv:pasay-ayala-bus', 'Pasay–Ayala sample bus', 'bus', 'illustrative-demo'),
  ('srv:pasay-ayala-uv', 'Pasay–Ayala sample UV', 'uv', 'illustrative-demo'),
  ('srv:pitx-moa-bus', 'PITX–MOA sample bus', 'bus', 'illustrative-demo'),
  ('srv:pitx-moa-modern', 'PITX–MOA modern jeepney', 'modern-jeepney', 'illustrative-demo'),
  ('srv:pitx-moa-uv', 'PITX–MOA sample UV', 'uv', 'illustrative-demo'),
  ('srv:ust-taft-bus', 'España–Taft sample bus', 'bus', 'illustrative-demo')
on conflict (id) do update set name = excluded.name, mode = excluded.mode, provenance = excluded.provenance;

-- Queue terminals
insert into public.queue_terminals (id, name, place_id, is_reportable, sort_order, provenance) values
  ('ust-espana', 'UST España', 'ust-frassati', true, 0, 'illustrative-demo'),
  ('sm-north-edsa', 'SM North EDSA', 'sm-north', true, 1, 'illustrative-demo'),
  ('pitx', 'PITX', 'pitx', true, 2, 'illustrative-demo'),
  ('one-ayala', 'One Ayala', 'one-ayala', true, 3, 'illustrative-demo'),
  ('pasay-rotonda', 'Pasay Rotonda', 'pasay-rotonda', true, 4, 'illustrative-demo'),
  ('moa-terminal', 'MOA Terminal', 'sm-moa', true, 5, 'illustrative-demo'),
  ('legarda-lrt', 'Legarda LRT', null, false, 6, 'illustrative-demo'),
  ('cubao-mrt', 'Cubao MRT', null, false, 7, 'illustrative-demo'),
  ('pasay-local-tricycle', 'Pasay local tricycle', null, false, 8, 'illustrative-demo'),
  ('libertad-bus', 'Libertad bus', null, false, 9, 'illustrative-demo'),
  ('ayala-mrt', 'Ayala MRT', null, false, 10, 'illustrative-demo'),
  ('pasay-mrt', 'Pasay MRT', null, false, 11, 'illustrative-demo')
on conflict (id) do update set name = excluded.name, place_id = excluded.place_id, is_reportable = excluded.is_reportable, sort_order = excluded.sort_order, provenance = excluded.provenance;

-- Directed segments (no reverse edges inferred)
insert into public.transport_segments (id, from_stop_id, to_stop_id, mode, service_id, signboard, instruction, travel_minutes, transfer_minutes, boarding_wait_minutes, queue_terminal_id, queue_default_level, queue_low_minutes, queue_mid_minutes, queue_high_minutes, provenance) values
  ('ust-road-walk', 'ust-frassati', 'ust-road', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample España boarding area; verify pedestrian access.', 3, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('ust-north-jeep', 'ust-road', 'north-jeep', 'jeepney', 'srv:ust-north-jeep', 'Quezon Ave / West Ave / SM North', 'Board the sample España–SM North jeepney service; confirm the actual stop and signboard with the operator.', 30, 3, 1, 'ust-espana', 'low', 4, 12, 28, 'illustrative-demo'),
  ('ust-north-uv', 'ust-road', 'north-uv', 'uv', 'srv:ust-north-uv', 'SM North / UV Express', 'Board the sample España–SM North UV Express service; confirm the actual stop and signboard with the operator.', 24, 3, 2, 'ust-espana', 'low', 8, 16, 30, 'illustrative-demo'),
  ('north-jeep-entry', 'north-jeep', 'sm-north', 'walk', null, 'Follow the sample walking connection', 'Walk from the sample drop-off toward the Annex entrance.', 6, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('north-uv-entry', 'north-uv', 'sm-north', 'walk', null, 'Follow the sample walking connection', 'Walk from the sample UV drop-off to SM North.', 4, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('ust-legarda', 'ust-frassati', 'legarda', 'walk', null, 'Follow the sample walking connection', 'Walk along the sample connection to Legarda; confirm safe pedestrian access.', 12, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('legarda-cubao', 'legarda', 'cubao-lrt', 'lrt', 'srv:legarda-cubao', 'Cubao / eastbound', 'Board the sample LRT sample eastbound leg service; confirm the actual stop and signboard with the operator.', 12, 3, 1, 'legarda-lrt', 'low', 3, 7, 15, 'illustrative-demo'),
  ('cubao-rail-transfer', 'cubao-lrt', 'cubao-mrt', 'walk', null, 'Follow the sample walking connection', 'Walk between the sample LRT and MRT transfer points.', 5, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('cubao-north', 'cubao-mrt', 'north-mrt', 'mrt', 'srv:cubao-north', 'North Avenue / northbound', 'Board the sample MRT sample northbound leg service; confirm the actual stop and signboard with the operator.', 10, 3, 1, 'cubao-mrt', 'low', 2, 6, 14, 'illustrative-demo'),
  ('north-mrt-entry', 'north-mrt', 'sm-north', 'walk', null, 'Follow the sample walking connection', 'Walk from the sample North Avenue exit toward the mall entrance.', 8, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('pasay-road-walk', 'pasay-rotonda', 'pasay-road', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample Pasay boarding area.', 3, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('pasay-moa-modern', 'pasay-road', 'moa-jeep', 'modern-jeepney', 'srv:pasay-moa-modern', 'MOA / modern jeepney', 'Board the sample Pasay–MOA modern jeepney service; confirm the actual stop and signboard with the operator.', 18, 3, 1, 'pasay-rotonda', 'low', 4, 10, 23, 'illustrative-demo'),
  ('pasay-moa-bus', 'pasay-road', 'moa-bus', 'bus', 'srv:pasay-moa-bus', 'Mall of Asia / city bus', 'Board the sample Pasay–MOA city bus service; confirm the actual stop and signboard with the operator.', 14, 3, 2, 'pasay-rotonda', 'mid', 3, 8, 24, 'illustrative-demo'),
  ('pasay-libertad-tricycle', 'pasay-road', 'libertad', 'tricycle', 'srv:pasay-libertad-tricycle', 'Libertad local stop', 'Board the sample Sample local tricycle connection service; confirm the actual stop and signboard with the operator.', 6, 3, 1, 'pasay-local-tricycle', 'low', 3, 7, 18, 'illustrative-demo'),
  ('libertad-transfer', 'libertad', 'libertad-bus', 'walk', null, 'Follow the sample walking connection', 'Walk to the mapped sample bus connection at Libertad.', 2, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('libertad-moa', 'libertad-bus', 'moa-jeep', 'bus', 'srv:libertad-moa', 'MOA terminal', 'Board the sample Libertad–MOA sample bus service; confirm the actual stop and signboard with the operator.', 12, 3, 1, 'libertad-bus', 'low', 4, 8, 20, 'illustrative-demo'),
  ('moa-jeep-entry', 'moa-jeep', 'sm-moa', 'walk', null, 'Follow the sample walking connection', 'Walk from the sample stop to the designated mall entrance.', 5, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('moa-bus-entry', 'moa-bus', 'sm-moa', 'walk', null, 'Follow the sample walking connection', 'Walk from the sample bus drop-off toward the mall entrance.', 6, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('ayala-road-walk', 'one-ayala', 'ayala-road', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample One Ayala road terminal.', 3, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('ayala-pitx-bus', 'ayala-road', 'pitx-platform', 'bus', 'srv:ayala-pitx-bus', 'PITX / southbound', 'Board the sample One Ayala–PITX city bus service; confirm the actual stop and signboard with the operator.', 40, 3, 2, 'one-ayala', 'mid', 4, 8, 25, 'illustrative-demo'),
  ('ayala-pitx-uv', 'ayala-road', 'pitx-platform', 'uv', 'srv:ayala-pitx-uv', 'PITX / UV Express', 'Board the sample One Ayala–PITX UV Express service; confirm the actual stop and signboard with the operator.', 31, 3, 2, 'one-ayala', 'mid', 6, 10, 28, 'illustrative-demo'),
  ('ayala-mrt-walk', 'one-ayala', 'ayala-mrt', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample Ayala MRT boarding point.', 7, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('ayala-taft-mrt', 'ayala-mrt', 'taft-mrt', 'mrt', 'srv:ayala-taft-mrt', 'Taft Avenue / southbound', 'Board the sample MRT sample southbound leg service; confirm the actual stop and signboard with the operator.', 12, 3, 1, 'ayala-mrt', 'low', 2, 6, 15, 'illustrative-demo'),
  ('taft-bus-transfer', 'taft-mrt', 'taft-bus', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample PITX-bound bus transfer point.', 5, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('taft-pitx-bus', 'taft-bus', 'pitx-platform', 'bus', 'srv:taft-pitx-bus', 'PITX terminal', 'Board the sample Taft–PITX sample bus service; confirm the actual stop and signboard with the operator.', 18, 3, 1, 'pasay-rotonda', 'low', 4, 9, 24, 'illustrative-demo'),
  ('pitx-arrival', 'pitx-platform', 'pitx', 'walk', null, 'Follow the sample walking connection', 'Walk into the sample PITX arrival area.', 4, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('pasay-mrt-walk', 'pasay-rotonda', 'taft-mrt', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample Taft MRT platform.', 5, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('taft-ayala-mrt', 'taft-mrt', 'ayala-mrt', 'mrt', 'srv:taft-ayala-mrt', 'Ayala / northbound', 'Board the sample MRT sample northbound leg service; confirm the actual stop and signboard with the operator.', 12, 3, 1, 'pasay-mrt', 'low', 4, 8, 20, 'illustrative-demo'),
  ('ayala-mrt-arrival', 'ayala-mrt', 'one-ayala', 'walk', null, 'Follow the sample walking connection', 'Walk from the sample MRT exit to One Ayala.', 7, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('pasay-ayala-bus', 'pasay-road', 'ayala-road', 'bus', 'srv:pasay-ayala-bus', 'Ayala / northbound', 'Board the sample Pasay–Ayala sample bus service; confirm the actual stop and signboard with the operator.', 42, 3, 1, 'pasay-rotonda', 'mid', 4, 10, 24, 'illustrative-demo'),
  ('pasay-ayala-uv', 'pasay-road', 'ayala-road', 'uv', 'srv:pasay-ayala-uv', 'Ayala / UV Express', 'Board the sample Pasay–Ayala sample UV service; confirm the actual stop and signboard with the operator.', 32, 3, 1, 'pasay-rotonda', 'low', 6, 12, 26, 'illustrative-demo'),
  ('ayala-road-arrival', 'ayala-road', 'one-ayala', 'walk', null, 'Follow the sample walking connection', 'Walk from the sample road drop-off to One Ayala.', 3, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('pitx-departure', 'pitx', 'pitx-platform', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample MOA-bound boarding area; confirm the actual bay.', 4, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('pitx-moa-bus', 'pitx-platform', 'moa-bus', 'bus', 'srv:pitx-moa-bus', 'MOA terminal', 'Board the sample PITX–MOA sample bus service; confirm the actual stop and signboard with the operator.', 22, 3, 1, 'pitx', 'mid', 4, 12, 27, 'illustrative-demo'),
  ('pitx-moa-modern', 'pitx-platform', 'moa-jeep', 'modern-jeepney', 'srv:pitx-moa-modern', 'MOA / modern jeepney', 'Board the sample PITX–MOA modern jeepney service; confirm the actual stop and signboard with the operator.', 18, 3, 1, 'pitx', 'low', 6, 13, 28, 'illustrative-demo'),
  ('pitx-moa-uv', 'pitx-platform', 'moa-jeep', 'uv', 'srv:pitx-moa-uv', 'MOA / UV Express', 'Board the sample PITX–MOA sample UV service; confirm the actual stop and signboard with the operator.', 15, 3, 1, 'pitx', 'low', 3, 9, 22, 'illustrative-demo'),
  ('ust-taft-walk', 'ust-frassati', 'ust-taft', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample Taft-bound boarding stop.', 4, 0, 0, null, null, null, null, null, 'illustrative-demo'),
  ('ust-taft-bus', 'ust-taft', 'taft-bus', 'bus', 'srv:ust-taft-bus', 'Taft / EDSA connection', 'Board the sample España–Taft sample bus service; confirm the actual stop and signboard with the operator.', 45, 3, 1, 'ust-espana', 'mid', 5, 13, 29, 'illustrative-demo'),
  ('taft-road-transfer', 'taft-bus', 'pasay-road', 'walk', null, 'Follow the sample walking connection', 'Walk to the sample MOA-bound transfer point.', 4, 0, 0, null, null, null, null, null, 'illustrative-demo')
on conflict (id) do update set from_stop_id = excluded.from_stop_id, to_stop_id = excluded.to_stop_id, mode = excluded.mode, service_id = excluded.service_id, signboard = excluded.signboard, instruction = excluded.instruction, travel_minutes = excluded.travel_minutes, transfer_minutes = excluded.transfer_minutes, boarding_wait_minutes = excluded.boarding_wait_minutes, queue_terminal_id = excluded.queue_terminal_id, queue_default_level = excluded.queue_default_level, queue_low_minutes = excluded.queue_low_minutes, queue_mid_minutes = excluded.queue_mid_minutes, queue_high_minutes = excluded.queue_high_minutes, provenance = excluded.provenance;

-- Popular sample journeys
insert into public.popular_journeys (origin_place_id, destination_place_id, sort_order) values
  ('ust-frassati', 'sm-north', 0),
  ('pasay-rotonda', 'sm-moa', 1),
  ('one-ayala', 'pitx', 2),
  ('pasay-rotonda', 'one-ayala', 3),
  ('pitx', 'sm-moa', 4),
  ('ust-frassati', 'sm-moa', 5)
on conflict (origin_place_id, destination_place_id) do update set sort_order = excluded.sort_order;

-- Fare matrices (illustrative samples — NOT official tariffs)
insert into public.fare_matrices (id, name, matrix_type, mode, calculator_mode, effective_from, source_name, verification_status, notes) values
  ('00000000-0000-4000-8000-000000000001', 'Illustrative sample segment fares — jeepney', 'segment', 'jeepney', null, '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000002', 'Illustrative sample segment fares — uv', 'segment', 'uv', null, '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000003', 'Illustrative sample segment fares — lrt', 'segment', 'lrt', null, '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000004', 'Illustrative sample segment fares — mrt', 'segment', 'mrt', null, '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000005', 'Illustrative sample segment fares — modern-jeepney', 'segment', 'modern-jeepney', null, '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000006', 'Illustrative sample segment fares — bus', 'segment', 'bus', null, '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000007', 'Illustrative sample segment fares — tricycle', 'segment', 'tricycle', null, '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000100', 'Illustrative sample distance calculator — jeep', 'distance', 'jeepney', 'jeep', '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000101', 'Illustrative sample distance calculator — bus', 'distance', 'bus', 'bus', '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'),
  ('00000000-0000-4000-8000-000000000102', 'Illustrative sample distance calculator — uv', 'distance', 'uv', 'uv', '2026-01-01T00:00:00+08:00', 'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)', 'illustrative-sample', 'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.')
on conflict (id) do update set name = excluded.name, matrix_type = excluded.matrix_type, mode = excluded.mode, calculator_mode = excluded.calculator_mode, effective_from = excluded.effective_from, source_name = excluded.source_name, verification_status = excluded.verification_status, notes = excluded.notes;

delete from public.fare_rules where fare_matrix_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102');
insert into public.fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount, included_km, per_km_amount) values
  ('00000000-0000-4000-8000-000000000001', 'regular', 'ust-north-jeep', 25, null, null),
  ('00000000-0000-4000-8000-000000000001', 'student', 'ust-north-jeep', 20, null, null),
  ('00000000-0000-4000-8000-000000000001', 'senior', 'ust-north-jeep', 20, null, null),
  ('00000000-0000-4000-8000-000000000001', 'pwd', 'ust-north-jeep', 20, null, null),
  ('00000000-0000-4000-8000-000000000002', 'regular', 'ust-north-uv', 45, null, null),
  ('00000000-0000-4000-8000-000000000002', 'student', 'ust-north-uv', 34, null, null),
  ('00000000-0000-4000-8000-000000000002', 'senior', 'ust-north-uv', 35, null, null),
  ('00000000-0000-4000-8000-000000000002', 'pwd', 'ust-north-uv', 35, null, null),
  ('00000000-0000-4000-8000-000000000003', 'regular', 'legarda-cubao', 25, null, null),
  ('00000000-0000-4000-8000-000000000003', 'student', 'legarda-cubao', 20, null, null),
  ('00000000-0000-4000-8000-000000000003', 'senior', 'legarda-cubao', 20, null, null),
  ('00000000-0000-4000-8000-000000000003', 'pwd', 'legarda-cubao', 20, null, null),
  ('00000000-0000-4000-8000-000000000004', 'regular', 'cubao-north', 20, null, null),
  ('00000000-0000-4000-8000-000000000004', 'student', 'cubao-north', 16, null, null),
  ('00000000-0000-4000-8000-000000000004', 'senior', 'cubao-north', 16, null, null),
  ('00000000-0000-4000-8000-000000000004', 'pwd', 'cubao-north', 16, null, null),
  ('00000000-0000-4000-8000-000000000005', 'regular', 'pasay-moa-modern', 20, null, null),
  ('00000000-0000-4000-8000-000000000005', 'student', 'pasay-moa-modern', 16, null, null),
  ('00000000-0000-4000-8000-000000000005', 'senior', 'pasay-moa-modern', 16, null, null),
  ('00000000-0000-4000-8000-000000000005', 'pwd', 'pasay-moa-modern', 16, null, null),
  ('00000000-0000-4000-8000-000000000006', 'regular', 'pasay-moa-bus', 24, null, null),
  ('00000000-0000-4000-8000-000000000006', 'student', 'pasay-moa-bus', 20, null, null),
  ('00000000-0000-4000-8000-000000000006', 'senior', 'pasay-moa-bus', 19, null, null),
  ('00000000-0000-4000-8000-000000000006', 'pwd', 'pasay-moa-bus', 19, null, null),
  ('00000000-0000-4000-8000-000000000007', 'regular', 'pasay-libertad-tricycle', 30, null, null),
  ('00000000-0000-4000-8000-000000000007', 'senior', 'pasay-libertad-tricycle', 25, null, null),
  ('00000000-0000-4000-8000-000000000007', 'pwd', 'pasay-libertad-tricycle', 25, null, null),
  ('00000000-0000-4000-8000-000000000006', 'regular', 'libertad-moa', 14, null, null),
  ('00000000-0000-4000-8000-000000000006', 'student', 'libertad-moa', 11, null, null),
  ('00000000-0000-4000-8000-000000000006', 'senior', 'libertad-moa', 11, null, null),
  ('00000000-0000-4000-8000-000000000006', 'pwd', 'libertad-moa', 11, null, null),
  ('00000000-0000-4000-8000-000000000006', 'regular', 'ayala-pitx-bus', 35, null, null),
  ('00000000-0000-4000-8000-000000000006', 'student', 'ayala-pitx-bus', 28, null, null),
  ('00000000-0000-4000-8000-000000000006', 'senior', 'ayala-pitx-bus', 28, null, null),
  ('00000000-0000-4000-8000-000000000006', 'pwd', 'ayala-pitx-bus', 28, null, null),
  ('00000000-0000-4000-8000-000000000002', 'regular', 'ayala-pitx-uv', 55, null, null),
  ('00000000-0000-4000-8000-000000000002', 'student', 'ayala-pitx-uv', 45, null, null),
  ('00000000-0000-4000-8000-000000000002', 'senior', 'ayala-pitx-uv', 44, null, null),
  ('00000000-0000-4000-8000-000000000002', 'pwd', 'ayala-pitx-uv', 44, null, null),
  ('00000000-0000-4000-8000-000000000004', 'regular', 'ayala-taft-mrt', 20, null, null),
  ('00000000-0000-4000-8000-000000000004', 'student', 'ayala-taft-mrt', 16, null, null),
  ('00000000-0000-4000-8000-000000000004', 'senior', 'ayala-taft-mrt', 16, null, null),
  ('00000000-0000-4000-8000-000000000004', 'pwd', 'ayala-taft-mrt', 16, null, null),
  ('00000000-0000-4000-8000-000000000006', 'regular', 'taft-pitx-bus', 18, null, null),
  ('00000000-0000-4000-8000-000000000006', 'student', 'taft-pitx-bus', 14, null, null),
  ('00000000-0000-4000-8000-000000000006', 'senior', 'taft-pitx-bus', 14, null, null),
  ('00000000-0000-4000-8000-000000000006', 'pwd', 'taft-pitx-bus', 14, null, null),
  ('00000000-0000-4000-8000-000000000004', 'regular', 'taft-ayala-mrt', 20, null, null),
  ('00000000-0000-4000-8000-000000000004', 'student', 'taft-ayala-mrt', 16, null, null),
  ('00000000-0000-4000-8000-000000000004', 'senior', 'taft-ayala-mrt', 16, null, null),
  ('00000000-0000-4000-8000-000000000004', 'pwd', 'taft-ayala-mrt', 16, null, null),
  ('00000000-0000-4000-8000-000000000006', 'regular', 'pasay-ayala-bus', 35, null, null),
  ('00000000-0000-4000-8000-000000000006', 'student', 'pasay-ayala-bus', 28, null, null),
  ('00000000-0000-4000-8000-000000000006', 'senior', 'pasay-ayala-bus', 28, null, null),
  ('00000000-0000-4000-8000-000000000006', 'pwd', 'pasay-ayala-bus', 28, null, null),
  ('00000000-0000-4000-8000-000000000002', 'regular', 'pasay-ayala-uv', 42, null, null),
  ('00000000-0000-4000-8000-000000000002', 'student', 'pasay-ayala-uv', 33, null, null),
  ('00000000-0000-4000-8000-000000000002', 'senior', 'pasay-ayala-uv', 32, null, null),
  ('00000000-0000-4000-8000-000000000002', 'pwd', 'pasay-ayala-uv', 32, null, null),
  ('00000000-0000-4000-8000-000000000006', 'regular', 'pitx-moa-bus', 16, null, null),
  ('00000000-0000-4000-8000-000000000006', 'student', 'pitx-moa-bus', 13, null, null),
  ('00000000-0000-4000-8000-000000000006', 'senior', 'pitx-moa-bus', 12, null, null),
  ('00000000-0000-4000-8000-000000000006', 'pwd', 'pitx-moa-bus', 12, null, null),
  ('00000000-0000-4000-8000-000000000005', 'regular', 'pitx-moa-modern', 22, null, null),
  ('00000000-0000-4000-8000-000000000005', 'student', 'pitx-moa-modern', 18, null, null),
  ('00000000-0000-4000-8000-000000000005', 'senior', 'pitx-moa-modern', 17, null, null),
  ('00000000-0000-4000-8000-000000000005', 'pwd', 'pitx-moa-modern', 17, null, null),
  ('00000000-0000-4000-8000-000000000002', 'regular', 'pitx-moa-uv', 30, null, null),
  ('00000000-0000-4000-8000-000000000002', 'student', 'pitx-moa-uv', 24, null, null),
  ('00000000-0000-4000-8000-000000000002', 'senior', 'pitx-moa-uv', 23, null, null),
  ('00000000-0000-4000-8000-000000000002', 'pwd', 'pitx-moa-uv', 23, null, null),
  ('00000000-0000-4000-8000-000000000006', 'regular', 'ust-taft-bus', 20, null, null),
  ('00000000-0000-4000-8000-000000000006', 'student', 'ust-taft-bus', 16, null, null),
  ('00000000-0000-4000-8000-000000000006', 'senior', 'ust-taft-bus', 16, null, null),
  ('00000000-0000-4000-8000-000000000006', 'pwd', 'ust-taft-bus', 16, null, null),
  ('00000000-0000-4000-8000-000000000100', 'regular', null, 13, 4, 2.2),
  ('00000000-0000-4000-8000-000000000100', 'student', null, 10.4, 4, 1.75),
  ('00000000-0000-4000-8000-000000000100', 'senior', null, 10.4, 4, 1.7),
  ('00000000-0000-4000-8000-000000000100', 'pwd', null, 10.4, 4, 1.7),
  ('00000000-0000-4000-8000-000000000101', 'regular', null, 15, 5, 2.5),
  ('00000000-0000-4000-8000-000000000101', 'student', null, 12, 5, 2),
  ('00000000-0000-4000-8000-000000000101', 'senior', null, 12, 5, 1.9),
  ('00000000-0000-4000-8000-000000000101', 'pwd', null, 12, 5, 1.9),
  ('00000000-0000-4000-8000-000000000102', 'regular', null, 16, 3, 2),
  ('00000000-0000-4000-8000-000000000102', 'student', null, 13, 3, 1.6),
  ('00000000-0000-4000-8000-000000000102', 'senior', null, 12.5, 3, 1.5),
  ('00000000-0000-4000-8000-000000000102', 'pwd', null, 12.5, 3, 1.5);

-- Simulated RoadWatch advisories (source_type demo, verification simulated)
insert into public.road_advisories (id, incident_id, title, description, category, severity, status, source_type, source_name, source_url, verification_status, area_name, impact_type, effect_confirmed, estimated_delay_minutes, delay_basis, delay_evidence, starts_at, ends_at, published_at, updated_at, suggested_action, is_published) values
  ('rw-espanaclosure', null, 'Simulation: España boarding segment closure', 'A simulated closure affects the mapped España jeepney segment. This is not a report of an actual road closure.', 'closure', 'high', 'active', 'demo', 'SakayWise local simulation', null, 'simulated', 'España Boulevard, Manila · Demo boarding area', 'segment-closure', true, null, null, null, now() + make_interval(mins => -30), now() + make_interval(mins => 120), now() + make_interval(mins => -40), now() + make_interval(mins => -5), 'Compare the remaining mapped demo itineraries and verify actual conditions before boarding.', true),
  ('rw-traffic', 'demo-espanatraffic', 'Simulation: minor España travel delay', 'An explicit three-minute additional riding delay is supplied for the mapped UV Express leg. It is separate from queue waiting.', 'traffic', 'moderate', 'active', 'demo', 'SakayWise local simulation', null, 'simulated', 'España Boulevard, Manila · UV Express sample segment', 'delay', true, 3, 'additional-travel', 'simulation', now() + make_interval(mins => -30), now() + make_interval(mins => 120), now() + make_interval(mins => -40), now() + make_interval(mins => -5), null, true),
  ('rw-service', null, 'Simulation: Pasay city bus interruption', 'The mapped Pasay–MOA city bus service is unavailable within this fictional scenario. Other services are not automatically suspended.', 'transport', 'high', 'active', 'demo', 'SakayWise local simulation', null, 'simulated', 'Pasay Rotonda · City Bus / MOA sample service', 'service-interruption', true, null, null, null, now() + make_interval(mins => -30), now() + make_interval(mins => 120), now() + make_interval(mins => -40), now() + make_interval(mins => -5), null, true),
  ('rw-flood-warning', null, 'Simulation: uncertain road access near Pasay', 'A fictional flooding warning has no confirmed passability or numeric delay. It warns commuters without closing a segment or changing its time.', 'flooding', 'critical', 'active', 'demo', 'SakayWise local simulation', null, 'simulated', 'Pasay Rotonda sample boarding area', 'unknown', false, null, null, null, now() + make_interval(mins => -30), now() + make_interval(mins => 120), now() + make_interval(mins => -40), now() + make_interval(mins => -5), 'Check reliable, current road access information before traveling. Do not infer that a route is safe from its availability in the demo.', true),
  ('rw-roadworks', null, 'Simulation: scheduled One Ayala roadworks', 'Sample maintenance starts later in the simulation. The supplied delay does not apply before the effective start.', 'roadworks', 'moderate', 'scheduled', 'demo', 'SakayWise local simulation', null, 'simulated', 'One Ayala terminal · Makati', 'delay', true, 8, 'additional-travel', 'simulation', now() + make_interval(mins => 60), now() + make_interval(mins => 180), now() + make_interval(mins => -40), now() + make_interval(mins => -5), null, true),
  ('rw-resolved', null, 'Simulation: resolved PITX access notice', 'This fictional terminal access issue has been resolved and must not change current route recommendations.', 'closure', 'high', 'resolved', 'demo', 'SakayWise local simulation', null, 'simulated', 'PITX, Parañaque', 'segment-closure', true, null, null, null, now() + make_interval(mins => -30), now() + make_interval(mins => -10), now() + make_interval(mins => -40), now() + make_interval(mins => -2), null, true),
  ('rw-expired', null, 'Simulation: ended MRT maintenance window', 'The sample effective period has ended. This advisory remains in the feed as expired and does not affect routing.', 'roadworks', 'moderate', 'active', 'demo', 'SakayWise local simulation', null, 'simulated', 'Legarda / Cubao rail sample connections', 'service-interruption', true, null, null, null, now() + make_interval(mins => -30), now() + make_interval(mins => -1), now() + make_interval(mins => -40), now() + make_interval(mins => -5), null, true),
  ('rw-unrelated', null, 'Simulation: Marikina local information', 'An unrelated sample notice near the sports center. It must not affect an España, Pasay, or One Ayala itinerary.', 'traffic', 'low', 'active', 'demo', 'SakayWise local simulation', null, 'simulated', 'Marikina Sports Center · Sumulong Highway', 'informational', false, null, null, null, now() + make_interval(mins => -30), now() + make_interval(mins => 120), now() + make_interval(mins => -40), now() + make_interval(mins => -5), null, true)
on conflict (id) do update set incident_id = excluded.incident_id, title = excluded.title, description = excluded.description, category = excluded.category, severity = excluded.severity, status = excluded.status, source_type = excluded.source_type, source_name = excluded.source_name, source_url = excluded.source_url, verification_status = excluded.verification_status, area_name = excluded.area_name, impact_type = excluded.impact_type, effect_confirmed = excluded.effect_confirmed, estimated_delay_minutes = excluded.estimated_delay_minutes, delay_basis = excluded.delay_basis, delay_evidence = excluded.delay_evidence, starts_at = excluded.starts_at, ends_at = excluded.ends_at, published_at = excluded.published_at, updated_at = excluded.updated_at, suggested_action = excluded.suggested_action, is_published = excluded.is_published;

delete from public.road_advisory_impacts where advisory_id in ('rw-espanaclosure', 'rw-traffic', 'rw-service', 'rw-flood-warning', 'rw-roadworks', 'rw-resolved', 'rw-expired', 'rw-unrelated');
insert into public.road_advisory_impacts (advisory_id, target_type, segment_id, stop_id, service_id, itinerary_id) values
  ('rw-espanaclosure', 'segment', 'ust-north-jeep', null, null, null),
  ('rw-traffic', 'segment', 'ust-north-uv', null, null, null),
  ('rw-service', 'service', null, null, 'srv:pasay-moa-bus', null),
  ('rw-flood-warning', 'stop', null, 'pasay-road', null, null),
  ('rw-roadworks', 'segment', 'ayala-pitx-uv', null, null, null),
  ('rw-resolved', 'stop', null, 'pitx-platform', null, null),
  ('rw-expired', 'service', null, null, 'srv:legarda-cubao', null),
  ('rw-unrelated', 'stop', null, 'marikina-sports', null, null);

commit;
