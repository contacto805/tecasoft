-- Requiere el esquema operativo de SoftTECAVO Validación.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS erp_login_attempts (email text PRIMARY KEY, attempts integer NOT NULL, started_at timestamptz NOT NULL);

CREATE TABLE IF NOT EXISTS quality_options (id serial PRIMARY KEY, quality_name text UNIQUE NOT NULL, display_name text NOT NULL, description text, color_code text, is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS pallet_configurations (id serial PRIMARY KEY, pallet_name text UNIQUE NOT NULL, pallet_type text, boxes_capacity integer, total_weight_kg numeric, description text, destino text, presentacion text, kg_por_caja numeric NOT NULL DEFAULT 10 CHECK (kg_por_caja IN (6,10)), cajas_por_tarima integer NOT NULL DEFAULT 96 CHECK (cajas_por_tarima BETWEEN 1 AND 10000), is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS pallet_materials (id serial PRIMARY KEY, pallet_config_id integer NOT NULL REFERENCES pallet_configurations(id) ON DELETE CASCADE, material_id integer NOT NULL REFERENCES materials_inventory(id), quantity_required numeric NOT NULL CHECK(quantity_required > 0), unit text, notes text, cost_source_type text, cost_source_id integer, cost_unit text, last_known_cost numeric, UNIQUE(pallet_config_id, material_id));

ALTER TABLE pallet_output_summary ADD COLUMN IF NOT EXISTS pallet_config_id integer REFERENCES pallet_configurations(id), ADD COLUMN IF NOT EXISTS selection_detail_id integer REFERENCES production_selection_details(id), ADD COLUMN IF NOT EXISTS package_kg integer, ADD COLUMN IF NOT EXISTS boxes_count integer, ADD COLUMN IF NOT EXISTS capacity_snapshot integer, ADD COLUMN IF NOT EXISTS pallet_ordinal integer, ADD COLUMN IF NOT EXISTS thermal_label_id integer, ADD COLUMN IF NOT EXISTS lot_number text;

CREATE UNIQUE INDEX IF NOT EXISTS erp_pallet_source_uq ON pallet_output_summary(selection_detail_id,package_kg,pallet_ordinal) WHERE selection_detail_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS erp_batch_request_uq ON production_batches(lot_id,idempotency_key) WHERE idempotency_key IS NOT NULL AND status='CONFIRMADO';

CREATE TABLE IF NOT EXISTS movements (id serial PRIMARY KEY, entity_type text NOT NULL, entity_id integer, lot_id integer REFERENCES lots(id), movement_type text NOT NULL, qty_before numeric, qty numeric, qty_after numeric, unit text, location_from text, location_to text, user_id text,user_name text,module text,reference text,notes text,created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS traceability_log (id serial PRIMARY KEY, master_batch_id integer REFERENCES master_batches(id), lot_id integer REFERENCES lots(id), event_type text NOT NULL, event_category text, event_description text, related_entity_type text, related_entity_id integer, material_quantities jsonb, user_id text,user_name text, metadata jsonb,created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS print_history (id serial PRIMARY KEY,template_id integer,lot_id integer REFERENCES lots(id),printer_id integer,label_data jsonb,quantity_printed integer,printed_by text,printed_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS lot_price_snapshot (id serial PRIMARY KEY,lot_id integer NOT NULL REFERENCES lots(id),price_applied numeric,price_type text,category text,kg_received numeric,total_cost numeric,created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS lot_performance (id serial PRIMARY KEY,lot_id integer NOT NULL UNIQUE REFERENCES lots(id),lot_number text,producer text,fruit_type text,entry_date date,public_scale_weight_kg numeric,total_kg_produced numeric,kg_by_caliber jsonb,total_kg_process numeric,total_kg_waste numeric,performance_percentage numeric,process_percentage numeric,waste_percentage numeric,generated_at timestamp DEFAULT now(),last_updated timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS lotification_records (id serial PRIMARY KEY,lot_id integer REFERENCES lots(id),box_size_10kg integer,box_size_6kg integer,grade_super integer,grade_extra integer,grade_primera integer,grade_mediano integer,grade_tercera integer,grade_cuarta integer,grade_super_b integer,grade_extra_b integer,grade_primera_b integer,grade_mediano_b integer,grade_tercera_b integer,grade_extra_6kg integer,grade_primera_6kg integer,grade_mediano_6kg integer,grade_tercera_6kg integer,total_kg_processed numeric,total_kg_waste numeric,total_kg_loss numeric,notes text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS dashboard_templates (id serial PRIMARY KEY,dashboard_image_url text,template_image_url text);

CREATE TABLE IF NOT EXISTS lot_dashboard_info (id serial PRIMARY KEY, lot_id integer NOT NULL UNIQUE REFERENCES lots(id), public_token text UNIQUE, is_active boolean DEFAULT true, template_id integer REFERENCES dashboard_templates(id), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS reempaque_operations (id serial PRIMARY KEY,folio text NOT NULL UNIQUE,operation_date date NOT NULL,responsible text,reason text,status text,notes text,additional_costs jsonb, source_pallet_ids jsonb,total_kg_withdrawn numeric,total_kg_recovered numeric,total_kg_to_process numeric,total_kg_to_desecho numeric,total_kg_merma numeric,request_key text UNIQUE,created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS reempaque_details (id serial PRIMARY KEY,reempaque_id integer NOT NULL REFERENCES reempaque_operations(id),source_pallet_id integer NOT NULL REFERENCES pallet_output_summary(id),lot_id integer NOT NULL REFERENCES lots(id),caliber_from text,class_from text,destination_type text NOT NULL,caliber_to text,class_to text,kg numeric NOT NULL CHECK(kg>0),boxes integer,output_pallet_id integer REFERENCES pallet_output_summary(id),created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS foreign_freights (id serial PRIMARY KEY,load_id integer REFERENCES load_history(id),lot_id integer REFERENCES lots(id),driver_name text, truck_plates text,trailer_plates text,freight_date date,notes text,created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS viajes (id serial PRIMARY KEY,folio text UNIQUE NOT NULL,fecha_salida date,customer_id integer REFERENCES customers(id),destino text,transportista text,placas text,numero_cajas integer,peso numeric,valor_usd numeric,estatus text,observaciones text,created_by text,updated_by text,load_history_id integer UNIQUE REFERENCES load_history(id),numero_carga text,referencia_interna text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS customer_trips (id serial PRIMARY KEY,customer_id integer REFERENCES customers(id),load_history_id integer UNIQUE REFERENCES load_history(id),trip_date date,total_kg numeric,boxes_count integer,price_per_trip numeric,currency text,status text,notes text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS abono_aplicaciones (id serial PRIMARY KEY,abono_id integer NOT NULL REFERENCES abonos(id),nota_id integer REFERENCES notas(id),viaje_id integer REFERENCES viajes(id),monto_aplicado_usd numeric NOT NULL CHECK(monto_aplicado_usd>0),created_by text,created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS cfdi_facturas (id serial PRIMARY KEY,folio_interno text,serie text,uuid text UNIQUE,fecha_timbrado timestamp,customer_id integer REFERENCES customers(id),rfc_cliente text,moneda text,importe numeric,importe_usd numeric,viaje_id integer REFERENCES viajes(id),nota_id integer REFERENCES notas(id),uso_factura text,fecha_cruce date,pedimento text,aduana text,agente_aduanal text,observaciones text,pdf_url text,xml_url text,estatus text,created_by text,created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS orchards (id serial PRIMARY KEY,name text NOT NULL,producer text,broker text,municipality text,locality text,state text,lat numeric,lng numeric,alt numeric,status text,notes text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS orchard_visits (id serial PRIMARY KEY,visit_date date,visit_time text,user_id text,acopiador text,device text,orchard_name text,producer text,broker text,municipality text,locality text,state text,lat numeric,lng numeric,alt numeric,precision_m numeric,super_percent numeric,extra_percent numeric,primera_percent numeric,mediano_percent numeric,tercera_percent numeric,cuarta_percent numeric,canica_percent numeric,clase2_percent numeric,proceso_percent numeric,desecho_percent numeric,trees_productive integer,young_trees integer,hectares numeric,est_kg numeric,est_ton numeric,observations text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS negotiations (id serial PRIMARY KEY,visit_id integer REFERENCES orchard_visits(id),status text,offered_price numeric,pact_price numeric,purchase_type text,payment_form text,tentative_cut_date date,observations text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS visit_photos (id serial PRIMARY KEY,visit_id integer REFERENCES orchard_visits(id),photo_url text,photo_type text,captured_at timestamp,user_name text,gps_lat numeric,gps_lng numeric);

CREATE TABLE IF NOT EXISTS flower_records (id serial PRIMARY KEY,visit_id integer REFERENCES orchard_visits(id),flower_type text,est_cut_date date,real_cut_date date,expected_kg numeric,real_kg numeric,notes text);

CREATE TABLE IF NOT EXISTS visit_calculator_evaluations (id serial PRIMARY KEY,visit_id integer REFERENCES orchard_visits(id),version integer,responsible text,evaluation_date date,est_kg_cut numeric,calculation_base text,sample_total_kg numeric,observations text,is_confirmed boolean, UNIQUE(visit_id,version));

CREATE TABLE IF NOT EXISTS visit_calculator_categories (id serial PRIMARY KEY,evaluation_id integer REFERENCES visit_calculator_evaluations(id),category_type text,name text,sample_kg numeric,projected_percent numeric,projected_kg numeric);

CREATE TABLE IF NOT EXISTS system_audit_log (id serial PRIMARY KEY,user_id text,user_name text,module text,action text,entity_type text,entity_id integer,description text,timestamp timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS precios_fruta_publicados (id serial PRIMARY KEY,semana integer,fecha_inicio date,fecha_fin date,tipo_calculo text,super_extra numeric,extra numeric,primera numeric,mediano numeric,tercera numeric,cuarta numeric,proceso numeric,canica numeric,desecho numeric,responsable text,telefono_1 text,telefono_2 text,direccion text,plantilla text,imagen_url text,usuario_publico text,activo boolean DEFAULT true,fecha_publicacion timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS financial_adjustments (id serial PRIMARY KEY,folio text UNIQUE,entity_type text,entity_id integer,adjustment_type text,original_value numeric,new_value numeric,delta numeric,reason text,requested_by text,authorized_by text,authorized_at timestamp,status text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS lot_accountant_documents (id serial PRIMARY KEY,lot_id integer REFERENCES lots(id),document_type text,document_url text,created_at timestamp DEFAULT now());

ALTER TABLE sales_of_process_and_waste ADD COLUMN IF NOT EXISTS request_key text, ADD COLUMN IF NOT EXISTS caliber text, ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MXN', ADD COLUMN IF NOT EXISTS exchange_rate numeric;

CREATE UNIQUE INDEX IF NOT EXISTS erp_subproduct_request_uq ON sales_of_process_and_waste(request_key) WHERE request_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS erp_operation_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source_table text NOT NULL, source_id text NOT NULL, lot_id integer, action text NOT NULL, actor_id text, previous_data jsonb, current_data jsonb, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp());

CREATE INDEX IF NOT EXISTS erp_operation_events_lot_idx ON erp_operation_events(lot_id,id DESC);

INSERT INTO quality_options(quality_name,display_name) VALUES ('A','A'),('B','B'),('Semi','Semi'),('Proceso','Proceso'),('Desecho','Desecho') ON CONFLICT DO NOTHING;

INSERT INTO pallet_configurations(pallet_name,pallet_type,boxes_capacity,total_weight_kg,presentacion,kg_por_caja,cajas_por_tarima) VALUES ('Caja 6 kg / 156 cajas','6kg',156,936,'6 kg',6,156),('Caja 10 kg / 96 cajas','10kg',96,960,'10 kg',10,96) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION erp_audit_operation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_row jsonb; after_row jsonb; row_data jsonb; linked_lot integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  IF before_row IS NOT DISTINCT FROM after_row THEN RETURN NULL; END IF;
  row_data := COALESCE(after_row,before_row);
  linked_lot := (row_data->>'lot_id')::integer;
  IF TG_TABLE_NAME = 'lots' THEN linked_lot := (row_data->>'id')::integer; END IF;
  IF TG_TABLE_NAME = 'material_deductions' THEN
    SELECT lot_id INTO linked_lot FROM production_batches WHERE id=(row_data->>'production_batch_id')::integer;
  END IF;
  INSERT INTO erp_operation_events(source_table,source_id,lot_id,action,actor_id,previous_data,current_data)
  VALUES(TG_TABLE_NAME,row_data->>'id',linked_lot,TG_OP,
    COALESCE(NULLIF(current_setting('tecavo.actor',true),''),row_data->>'user_id',row_data->>'recorded_by',row_data->>'created_by'),
    before_row,after_row);
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orchard_visits','negotiations','cutting_orders','lots','fruit_input_weighings','weighings','production_batches','production_selection_details','pallet_configurations','pallet_materials','pallet_output_summary','warehouse_map_movements','reempaque_operations','reempaque_details','material_deductions','materials_inventory','load_history','load_details','trailer_load_map','sales_of_process_and_waste','customer_accounts','viajes','notas','cfdi_facturas','abonos','abono_aplicaciones','payment_schedule','producer_payments','purchase_orders','purchase_receptions','expenses','operating_costs','crew_freights','foreign_freights','broker_notes','payroll_periods','payroll_records','bank_movements','weekly_closings','financial_adjustments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=t::regclass AND tgname='erp_record_operation') THEN
      EXECUTE format('CREATE TRIGGER erp_record_operation AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION erp_audit_operation()',t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION erp_validate_production(lot integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE received numeric; allocated numeric; tolerance numeric;
BEGIN
  PERFORM 1 FROM lots WHERE id=lot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote inexistente' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE(
    (SELECT NULLIF(sum(total_kg_weighed),0) FROM fruit_input_weighings WHERE lot_id=lot),
    (SELECT NULLIF(sum(net_weight),0) FROM weighings WHERE lot_id=lot),0) INTO received;
  SELECT COALESCE((SELECT CASE WHEN value ~ '^[0-9]+([.][0-9]+)?$' THEN value::numeric END
    FROM system_settings WHERE key='SELECTION_PHYSICAL_TOLERANCE_KG' LIMIT 1),5) INTO tolerance;
  SELECT COALESCE(sum(COALESCE(b.process_kg,0)+COALESCE(b.desecho_kg,0)+COALESCE(b.merma_kg,0)+
    COALESCE((SELECT sum(d.total_kg) FROM production_selection_details d WHERE d.production_batch_id=b.id),0)),0)
  INTO allocated FROM production_batches b WHERE b.lot_id=lot AND b.status='CONFIRMADO';
  IF received <= 0 OR allocated > received+tolerance THEN
    RAISE EXCEPTION 'Lote %: % kg asignados frente a % kg recibidos (tolerancia % kg)',lot,allocated,received,tolerance USING ERRCODE='23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION erp_save_production(lot integer, on_date date, requested_status text, process numeric, waste numeric, loss numeric,
  reason text, operator_id text, operator_name text, shift_name text, remarks text, request_key text, lines jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE batch production_batches; final boolean := requested_status='CONFIRMADO';
BEGIN
  PERFORM set_config('tecavo.actor',COALESCE(operator_id,''),true);
  PERFORM 1 FROM lots WHERE id=lot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote inexistente' USING ERRCODE='P0002'; END IF;
  IF final AND request_key IS NOT NULL THEN
    SELECT * INTO batch FROM production_batches WHERE lot_id=lot AND status='CONFIRMADO' AND idempotency_key=request_key;
    IF FOUND THEN RETURN jsonb_build_object('batch',to_jsonb(batch),'deduped',true); END IF;
  END IF;
  IF requested_status NOT IN ('CONFIRMADO','BORRADOR','VALIDADO') OR least(process,waste,loss)<0 THEN
    RAISE EXCEPTION 'Corrida inválida' USING ERRCODE='23514';
  END IF;
  SELECT * INTO batch FROM production_batches WHERE lot_id=lot AND COALESCE(status,'BORRADOR') IN ('BORRADOR','VALIDADO') ORDER BY id DESC LIMIT 1;
  IF batch.id IS NULL THEN
    INSERT INTO production_batches(lot_id,production_date,status) VALUES(lot,on_date,'BORRADOR') RETURNING * INTO batch;
  END IF;
  DELETE FROM production_selection_details WHERE production_batch_id=batch.id;
  INSERT INTO production_selection_details(production_batch_id,lot_id,caliber,class_name,boxes_10kg,boxes_6kg,additional_granel_kg,total_kg)
    SELECT batch.id,lot,trim(d.caliber),COALESCE(NULLIF(trim(d.class_name),''),'A'),d.boxes_10kg,d.boxes_6kg,
      COALESCE(d.additional_granel_kg,0), d.boxes_10kg::numeric*10+d.boxes_6kg::numeric*6+COALESCE(d.additional_granel_kg,0)
    FROM jsonb_to_recordset(lines) AS d(caliber text,class_name text,boxes_10kg integer,boxes_6kg integer,additional_granel_kg numeric)
    WHERE d.boxes_10kg::numeric*10+d.boxes_6kg::numeric*6+COALESCE(d.additional_granel_kg,0)>0;
  UPDATE production_batches SET production_date=on_date,status=requested_status,process_kg=process,desecho_kg=waste,merma_kg=loss,
    merma_causa=reason,responsable=operator_name,turno=shift_name,observaciones=remarks,idempotency_key=request_key,
    version=COALESCE(version,0)+1,confirmed_at=CASE WHEN final THEN now() END,updated_at=now()
  WHERE id=batch.id RETURNING * INTO batch;
  IF final THEN PERFORM erp_validate_production(lot); END IF;
  RETURN jsonb_build_object('batch',to_jsonb(batch),'deduped',false);
END $$;

CREATE OR REPLACE FUNCTION erp_confirm_production(batch_id integer, actor text, request_key text, remarks text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE b production_batches; prior production_batches;
BEGIN
  SELECT * INTO b FROM production_batches WHERE id=batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corrida inexistente' USING ERRCODE='P0002'; END IF;
  PERFORM 1 FROM lots WHERE id=b.lot_id FOR UPDATE;
  SELECT * INTO b FROM production_batches WHERE id=batch_id;
  IF b.status='CONFIRMADO' THEN RETURN jsonb_build_object('batch',to_jsonb(b),'deduped',true); END IF;
  IF COALESCE(b.status,'BORRADOR') NOT IN ('BORRADOR','VALIDADO') THEN RAISE EXCEPTION 'Corrida no disponible' USING ERRCODE='23514'; END IF;
  IF request_key IS NOT NULL THEN
    SELECT * INTO prior FROM production_batches WHERE lot_id=b.lot_id AND status='CONFIRMADO' AND idempotency_key=request_key;
    IF FOUND THEN RETURN jsonb_build_object('batch',to_jsonb(prior),'deduped',true); END IF;
  END IF;
  PERFORM set_config('tecavo.actor',COALESCE(actor,''),true);
  UPDATE production_batches SET status='CONFIRMADO',confirmed_at=now(),version=COALESCE(version,0)+1,
    idempotency_key=COALESCE(request_key,idempotency_key),observaciones=COALESCE(NULLIF(remarks,''),observaciones),updated_at=now()
  WHERE id=batch_id RETURNING * INTO b;
  PERFORM erp_validate_production(b.lot_id);
  RETURN jsonb_build_object('batch',to_jsonb(b),'deduped',false);
END $$;

CREATE OR REPLACE FUNCTION erp_pack_production(batch_id integer, lot integer, actor text, requested_configs jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE b production_batches; lot_ref lots; cfg pallet_configurations; d record; m record; p integer;
  i integer; n integer; quantity integer; new_id integer; existing jsonb; config_count integer;
BEGIN
  PERFORM set_config('tecavo.actor',COALESCE(actor,''),true);
  SELECT * INTO lot_ref FROM lots WHERE id=lot FOR UPDATE;
  SELECT * INTO b FROM production_batches WHERE id=batch_id AND lot_id=lot AND status='CONFIRMADO';
  IF NOT FOUND THEN RAISE EXCEPTION 'La corrida debe estar confirmada y pertenecer al lote' USING ERRCODE='23514'; END IF;
  SELECT jsonb_agg(to_jsonb(x) ORDER BY id) INTO existing FROM pallet_output_summary x WHERE production_batch_id=batch_id AND lot_id=lot;
  IF existing IS NOT NULL THEN RETURN jsonb_build_object('records',existing,'deduped',true); END IF;
  FOR d IN SELECT x.*, f.kg, f.boxes FROM production_selection_details x
    CROSS JOIN LATERAL (VALUES(6,x.boxes_6kg),(10,x.boxes_10kg)) f(kg,boxes)
    WHERE x.production_batch_id=batch_id AND x.lot_id=lot AND f.boxes>0 ORDER BY x.id,f.kg
  LOOP
    SELECT count(*),min(id) INTO config_count,p FROM pallet_configurations
    WHERE is_active IS TRUE AND kg_por_caja=d.kg AND
      (requested_configs->>d.kg::text IS NULL OR id=(requested_configs->>d.kg::text)::integer);
    IF config_count<>1 THEN RAISE EXCEPTION 'Selecciona una configuración activa para caja de % kg',d.kg USING ERRCODE='23514'; END IF;
    SELECT * INTO cfg FROM pallet_configurations WHERE id=p FOR SHARE;
    n := (d.boxes-1)/cfg.cajas_por_tarima+1;
    FOR i IN 1..n LOOP
      quantity := least(cfg.cajas_por_tarima,d.boxes-(i-1)*cfg.cajas_por_tarima);
      INSERT INTO pallet_output_summary(production_batch_id,lot_id,lot_number,master_batch_id,pallet_type,caliber,class_name,pallet_count,total_kg,
        packing_date,estado,version_registro,source_system,source_id,pallet_config_id,selection_detail_id,package_kg,boxes_count,capacity_snapshot,pallet_ordinal,folio_tarima)
      VALUES(batch_id,lot,lot_ref.lot_number,b.master_batch_id,cfg.pallet_type,d.caliber,d.class_name,1,quantity*d.kg,
        timezone('America/Mexico_City',now())::date,'PENDIENTE_UBICACION',1,'production',d.id,p,d.id,d.kg,quantity,cfg.cajas_por_tarima,i,
        format('TAR-C%s-D%s-%s-%s',batch_id,d.id,d.kg,i)) RETURNING id INTO new_id;
      FOR m IN SELECT pm.material_id,pm.quantity_required,
        COALESCE(CASE pm.cost_source_type WHEN 'purchase' THEN po.unit_price WHEN 'expense' THEN e.cost_per_unit END,
          mi.costo_promedio,mi.cost_per_unit) AS cost
        FROM pallet_materials pm JOIN materials_inventory mi ON mi.id=pm.material_id
        LEFT JOIN purchase_orders po ON po.id=pm.cost_source_id AND pm.cost_source_type='purchase'
        LEFT JOIN expenses e ON e.id=pm.cost_source_id AND pm.cost_source_type='expense'
        WHERE pm.pallet_config_id=p ORDER BY pm.material_id LOOP
        IF m.cost IS NULL OR m.cost<0 THEN RAISE EXCEPTION 'Material % sin costo válido',m.material_id USING ERRCODE='23514'; END IF;
        UPDATE materials_inventory SET quantity_available=quantity_available-m.quantity_required,updated_at=now()
        WHERE id=m.material_id AND quantity_available>=m.quantity_required;
        IF NOT FOUND THEN RAISE EXCEPTION 'Existencia insuficiente para material %',m.material_id USING ERRCODE='23514'; END IF;
        INSERT INTO material_deductions(production_batch_id,material_id,quantity_used,costo_unitario_aplicado,costo_total,pallet_config_id,pallet_output_id)
        VALUES(batch_id,m.material_id,m.quantity_required,m.cost,m.cost*m.quantity_required,p,new_id);
      END LOOP;
    END LOOP;
  END LOOP;
  SELECT jsonb_agg(to_jsonb(x) ORDER BY id) INTO existing FROM pallet_output_summary x WHERE production_batch_id=batch_id AND lot_id=lot;
  RETURN jsonb_build_object('records',COALESCE(existing,'[]'::jsonb),'deduped',false);
END $$;

CREATE OR REPLACE VIEW erp_subproduct_balance AS
WITH production AS (
  SELECT lot_id,sum(COALESCE(process_kg,0)) AS process_kg,sum(COALESCE(desecho_kg,0)) AS waste_kg
  FROM production_batches WHERE status='CONFIRMADO' GROUP BY lot_id
), repacking AS (
  SELECT d.lot_id,sum(d.kg) FILTER (WHERE d.destination_type='proceso') AS process_kg,
    sum(d.kg) FILTER (WHERE d.destination_type='desecho') AS waste_kg
  FROM reempaque_details d JOIN reempaque_operations o ON o.id=d.reempaque_id AND o.status='CONFIRMADO' GROUP BY d.lot_id
), sales AS (
  SELECT COALESCE(s.lot_id,b.lot_id) lot_id,sum(COALESCE(s.process_kg,0)) process_kg,sum(COALESCE(s.waste_kg,0)) waste_kg
  FROM sales_of_process_and_waste s LEFT JOIN master_batches b ON b.id=s.master_batch_id
  WHERE lower(COALESCE(s.payment_status,'')) NOT IN ('cancelado','cancelada','cancelled','canceled','anulado','anulada')
  GROUP BY COALESCE(s.lot_id,b.lot_id)
)
SELECT l.id AS lot_id,COALESCE(p.process_kg,0)+COALESCE(r.process_kg,0)-COALESCE(s.process_kg,0) AS process_kg,
COALESCE(p.waste_kg,0)+COALESCE(r.waste_kg,0)-COALESCE(s.waste_kg,0) AS waste_kg
FROM lots l LEFT JOIN production p ON p.lot_id=l.id LEFT JOIN repacking r ON r.lot_id=l.id LEFT JOIN sales s ON s.lot_id=l.id;

CREATE OR REPLACE FUNCTION erp_sell_subproduct(lot integer, customer integer, kind text, grade text, qty numeric, price numeric, sold_on date, ccy text, fx numeric, remarks text, actor text, key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE stock erp_subproduct_balance; sale sales_of_process_and_waste; buyer customers; ref text;
BEGIN
  IF kind NOT IN ('process','waste') OR qty<=0 OR price<0 OR ccy NOT IN ('MXN','USD') OR (ccy='USD' AND COALESCE(fx,0)<=0) OR NULLIF(key,'') IS NULL THEN
    RAISE EXCEPTION 'Datos de venta inválidos' USING ERRCODE='23514';
  END IF;
  PERFORM set_config('tecavo.actor',COALESCE(actor,''),true);
  PERFORM 1 FROM lots WHERE id=lot FOR UPDATE;
  SELECT * INTO stock FROM erp_subproduct_balance WHERE lot_id=lot;
  SELECT * INTO buyer FROM customers WHERE id=customer;
  IF stock.lot_id IS NULL OR buyer.id IS NULL THEN RAISE EXCEPTION 'Lote o cliente inexistente' USING ERRCODE='P0002'; END IF;
  SELECT * INTO sale FROM sales_of_process_and_waste WHERE request_key=key;
  IF FOUND THEN
    IF sale.lot_id<>lot OR sale.customer_id<>customer OR sale.net_weight<>qty OR sale.unit_price<>price OR sale.currency<>ccy
      OR sale.date<>sold_on OR sale.caliber IS DISTINCT FROM grade OR (sale.process_kg>0)<>(kind='process')
      OR sale.exchange_rate IS DISTINCT FROM (CASE WHEN ccy='USD' THEN fx ELSE 1 END) THEN
      RAISE EXCEPTION 'La referencia ya se usó en otra venta' USING ERRCODE='23505';
    END IF;
    RETURN to_jsonb(sale);
  END IF;
  IF qty > (CASE WHEN kind='process' THEN stock.process_kg ELSE stock.waste_kg END) THEN
    RAISE EXCEPTION 'Existencia insuficiente para la salida solicitada' USING ERRCODE='23514';
  END IF;
  ref := 'SP-'||gen_random_uuid()::text;
  INSERT INTO sales_of_process_and_waste(lot_id,customer_id,buyer_name,product_name,process_kg,waste_kg,net_weight,unit_price,total_price,
    date,notes,sales_folio,caliber,currency,exchange_rate,payment_status,user_id,request_key)
  VALUES(lot,customer,buyer.customer_name,CASE WHEN kind='process' THEN 'Proceso' ELSE 'Desecho' END,
    CASE WHEN kind='process' THEN qty ELSE 0 END,CASE WHEN kind='waste' THEN qty ELSE 0 END,qty,price,round(qty*price,2),
    sold_on,remarks,ref,grade,ccy,CASE WHEN ccy='USD' THEN fx ELSE 1 END,'pendiente',actor,key) RETURNING * INTO sale;
  INSERT INTO customer_accounts(customer_id,trip_type,trip_reference_id,trip_date,description,amount_usd,amount_mxn,exchange_rate,transaction_type,notes)
  VALUES(customer,kind,sale.id,sold_on,ref,CASE WHEN ccy='USD' THEN sale.total_price END,
    round(sale.total_price*sale.exchange_rate,2),sale.exchange_rate,'receivable',remarks);
  RETURN to_jsonb(sale);
END $$;

CREATE OR REPLACE FUNCTION erp_repack(ops jsonb, actor text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE o reempaque_operations; p pallet_output_summary; source record; d record; on_date date;
  key text := NULLIF(ops->>'idempotency_key',''); cost numeric; remaining numeric; name text := COALESCE(ops->>'responsible',actor);
  selected jsonb:=ops->'selected_pallets'; destinations jsonb:=ops->'reselection'; new_id integer; kg6 integer;
BEGIN
  PERFORM set_config('tecavo.actor',COALESCE(actor,''),true);
  PERFORM pg_advisory_xact_lock(hashtext('tecavo-confirm-shipment'));
  IF key IS NOT NULL THEN
    SELECT * INTO o FROM reempaque_operations WHERE request_key=key;
    IF FOUND THEN RETURN to_jsonb(o); END IF;
  END IF;
  on_date:=COALESCE(NULLIF(ops->>'operation_date','')::date,timezone('America/Mexico_City',now())::date);
  IF COALESCE(jsonb_array_length(selected),0)=0 OR COALESCE(jsonb_array_length(destinations),0)=0 OR
    (SELECT count(*)<>count(DISTINCT x.id) FROM jsonb_to_recordset(selected) x(id integer)) OR
    EXISTS(SELECT 1 FROM jsonb_to_recordset(destinations) x(source_pallet_id integer,kg numeric,destination_type text)
      WHERE x.kg IS NULL OR x.kg<=0 OR x.destination_type IS NULL OR x.destination_type NOT IN ('recuperada','proceso','desecho','merma')
      OR NOT EXISTS(SELECT 1 FROM jsonb_to_recordset(selected) y(id integer) WHERE y.id=x.source_pallet_id))
  THEN RAISE EXCEPTION 'Selección de tarimas o destinos inválida' USING ERRCODE='23514'; END IF;
  PERFORM l.id FROM lots l WHERE l.id IN (
    SELECT ps.lot_id FROM pallet_output_summary ps JOIN jsonb_to_recordset(selected) x(id integer) ON x.id=ps.id
  ) ORDER BY l.id FOR UPDATE;
  INSERT INTO reempaque_operations(folio,operation_date,responsible,reason,status,notes,additional_costs,source_pallet_ids,request_key)
  VALUES('REEMP-'||gen_random_uuid()::text,on_date,name,ops->>'reason','CONFIRMADO',ops->>'notes',ops->'additional_costs',
    (SELECT jsonb_agg(x.id) FROM jsonb_to_recordset(selected) x(id integer)),key) RETURNING * INTO o;
  FOR source IN SELECT * FROM jsonb_to_recordset(selected) x(id integer,kg_to_withdraw numeric) ORDER BY id LOOP
    SELECT * INTO p FROM pallet_output_summary WHERE id=source.id FOR UPDATE;
    IF NOT FOUND OR p.embarque_id IS NOT NULL OR p.lot_id IS NULL OR p.package_kg NOT IN(6,10) OR p.package_kg IS NULL OR
      UPPER(COALESCE(p.estado,'')) IN ('EMBARCADA','CANCELADA','REEMPACADA') OR UPPER(COALESCE(p.ubicacion_actual,'')) LIKE 'TRAILER-%' OR
      source.kg_to_withdraw IS NULL OR source.kg_to_withdraw<=0 OR source.kg_to_withdraw>p.total_kg OR mod(source.kg_to_withdraw,p.package_kg)<>0 OR
      source.kg_to_withdraw IS DISTINCT FROM (SELECT sum(x.kg) FROM jsonb_to_recordset(destinations) x(source_pallet_id integer,kg numeric) WHERE x.source_pallet_id=p.id)
    THEN RAISE EXCEPTION 'Tarima %: verifica existencia, presentación y balance de kilos',source.id USING ERRCODE='23514'; END IF;
    remaining:=p.total_kg-source.kg_to_withdraw;
    UPDATE pallet_output_summary SET total_kg=remaining, boxes_count=remaining/p.package_kg,pallet_count=CASE WHEN remaining=0 THEN 0 ELSE 1 END,
      estado=CASE WHEN remaining=0 THEN 'REEMPACADA' ELSE p.estado END,
      warehouse_slot=CASE WHEN remaining>0 THEN p.warehouse_slot END,ubicacion_actual=CASE WHEN remaining>0 THEN p.ubicacion_actual END,
      updated_at=now(),version_registro=COALESCE(version_registro,1)+1 WHERE id=p.id;
    FOR d IN SELECT * FROM jsonb_to_recordset(destinations) x(source_pallet_id integer,destination_type text,kg numeric,caliber_to text,class_to text)
      WHERE x.source_pallet_id=p.id LOOP
      new_id:=NULL;
      kg6:=NULL;
      IF d.destination_type='recuperada' THEN
        IF mod(d.kg,p.package_kg)<>0 THEN RAISE EXCEPTION 'Recuperación requiere cajas completas de % kg',p.package_kg USING ERRCODE='23514'; END IF;
        kg6:=d.kg/p.package_kg;
        INSERT INTO pallet_output_summary(lot_id,lot_number,master_batch_id,pallet_type,caliber,class_name,pallet_count,total_kg,packing_date,
          estado,version_registro,source_system,source_id,pallet_config_id,package_kg,boxes_count,capacity_snapshot,folio_tarima)
        VALUES(p.lot_id,p.lot_number,p.master_batch_id,p.pallet_type,COALESCE(NULLIF(d.caliber_to,''),p.caliber),COALESCE(NULLIF(d.class_to,''),p.class_name),
          1,d.kg,on_date,'PENDIENTE_UBICACION',1,'reempaque',o.id,p.pallet_config_id,p.package_kg,kg6,p.capacity_snapshot,'TAR-R-'||gen_random_uuid()::text)
        RETURNING id INTO new_id;
      END IF;
      INSERT INTO reempaque_details(reempaque_id,source_pallet_id,lot_id,caliber_from,class_from,destination_type,caliber_to,class_to,kg,boxes,output_pallet_id)
      VALUES(o.id,p.id,p.lot_id,p.caliber,p.class_name,d.destination_type,d.caliber_to,d.class_to,d.kg,kg6,new_id);
    END LOOP;
  END LOOP;
  UPDATE reempaque_operations SET (total_kg_withdrawn,total_kg_recovered,total_kg_to_process,total_kg_to_desecho,total_kg_merma)=
    (SELECT sum(kg),COALESCE(sum(kg) FILTER(WHERE destination_type='recuperada'),0),COALESCE(sum(kg) FILTER(WHERE destination_type='proceso'),0),
      COALESCE(sum(kg) FILTER(WHERE destination_type='desecho'),0),COALESCE(sum(kg) FILTER(WHERE destination_type='merma'),0)
      FROM reempaque_details WHERE reempaque_id=o.id)
    WHERE id=o.id RETURNING * INTO o;
  SELECT COALESCE(sum(v::numeric),0) INTO cost FROM jsonb_each_text(COALESCE(ops->'additional_costs','{}')) AS c(k,v)
    WHERE k IN ('mano_obra','materiales','otros') AND NULLIF(v,'') IS NOT NULL;
  IF cost<0 THEN RAISE EXCEPTION 'Costo adicional inválido' USING ERRCODE='23514'; END IF;
  IF cost>0 THEN
    INSERT INTO operating_costs(folio,cost_date,week_number,week_year,cost_type,cost_category,cost_concept,description,amount,amount_mxn,currency,module_origin,status,registered_by)
    VALUES(o.folio,on_date,EXTRACT(WEEK FROM on_date),EXTRACT(ISOYEAR FROM on_date),'reempaque','operativo','Reempaque',o.reason,cost,cost,'MXN','reempaque','confirmado',actor);
  END IF;
  RETURN to_jsonb(o);
END $$;

INSERT INTO menu_groups(group_name,group_order,applies_to)
SELECT v.name,v.position,v.role FROM (VALUES('Acopios',1,'campo'),('Operaciones',2,'operaciones'),('Inventarios y embarques',3,'operaciones'),('Administración',4,'administrador')) v(name,position,role)
WHERE NOT EXISTS(SELECT 1 FROM menu_groups g WHERE g.group_name=v.name);

INSERT INTO menu_modules(group_id,module_name,module_route,module_key,display_name,module_order,group_access)
SELECT g.id,v.name,v.route,v.code,v.name,v.position,jsonb_build_array(g.applies_to)
FROM (VALUES ('Acopios','Acopios','/acopios','acopios',1),
('Operaciones','Órdenes de corte','/cutting-orders','cutting-orders',1),('Operaciones','Producción','/production','production',2),
('Inventarios y embarques','Inventario','/inventory','inventory',1),('Inventarios y embarques','Mapa de almacén','/mapa-almacen','warehouse-map',2),
('Inventarios y embarques','Reempaque','/reempaque','reempaque',3),('Inventarios y embarques','Embarques','/embarques','shipments',4),
('Administración','Administración','/administracion','administracion',1),('Administración','Cartera','/cartera','cartera',2),
('Administración','Gastos','/expenses','expenses',3),('Administración','Cierre semanal','/cierres','weekly-closings',4))
v(group_name,name,route,code,position) JOIN menu_groups g ON g.group_name=v.group_name
WHERE NOT EXISTS(SELECT 1 FROM menu_modules mm WHERE mm.module_route=v.route);

COMMIT;
