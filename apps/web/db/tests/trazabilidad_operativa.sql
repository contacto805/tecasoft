DO $$
DECLARE l integer; b integer; customer integer; p integer; v jsonb; count_boxes numeric; count_kg numeric;
BEGIN
  BEGIN
    INSERT INTO lots(lot_number,producer,fruit_type,date,fruit_price) VALUES('QA-'||gen_random_uuid(),'QA','Hass','2026-11-20',12) RETURNING id INTO l;
    INSERT INTO fruit_input_weighings(lot_id,total_kg_weighed,public_scale_date) VALUES(l,2200,'2026-11-20');
    INSERT INTO customers(customer_name) VALUES('QA') RETURNING id INTO customer;
    v:=erp_save_production(l,'2026-11-21','CONFIRMADO',40,20,8,'QA','qa','QA','MATUTINO','QA','qa-key',
      '[{"caliber":"extra","class_name":"A","boxes_6kg":157,"boxes_10kg":97,"additional_granel_kg":0}]');
    b:=(v->'batch'->>'id')::integer;
    v:=erp_pack_production(b,l,'qa','{}');
    IF jsonb_array_length(v->'records')<>4 THEN RAISE EXCEPTION 'QA: expected 4 pallets'; END IF;
    SELECT sum(boxes_count),sum(total_kg) INTO count_boxes,count_kg FROM pallet_output_summary WHERE lot_id=l;
    IF count_boxes<>254 OR count_kg<>1912 THEN RAISE EXCEPTION 'QA: boxes %, kg %',count_boxes,count_kg; END IF;
    IF (erp_pack_production(b,l,'qa','{}')->>'deduped')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'QA: pack retry'; END IF;
    BEGIN
      PERFORM erp_save_production(l,'2026-11-21','CONFIRMADO',500,0,0,'QA','qa','QA','MATUTINO','QA','qa-over','[]');
      RAISE EXCEPTION 'QA: overage accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    SELECT id INTO p FROM pallet_output_summary WHERE lot_id=l AND package_kg=6 AND boxes_count=156;
    v:=erp_repack(jsonb_build_object('idempotency_key','qa-r','selected_pallets',jsonb_build_array(jsonb_build_object('id',p,'kg_to_withdraw',18)),
      'reselection',jsonb_build_array(jsonb_build_object('source_pallet_id',p,'destination_type','recuperada','kg',6),jsonb_build_object('source_pallet_id',p,'destination_type','proceso','kg',12))), 'qa');
    IF (v->>'total_kg_to_process')::numeric<>12 OR (SELECT process_kg FROM erp_subproduct_balance WHERE lot_id=l)<>52 THEN RAISE EXCEPTION 'QA: repacking balance'; END IF;
    v:=erp_sell_subproduct(l,customer,'process','extra',15,4,'2026-11-24','USD',20,'QA','qa','qa-sale');
    IF v<>erp_sell_subproduct(l,customer,'process','extra',15,4,'2026-11-24','USD',20,'QA','qa','qa-sale') OR
      (SELECT process_kg FROM erp_subproduct_balance WHERE lot_id=l)<>37 OR
      (SELECT count(*) FROM customer_accounts WHERE customer_id=customer AND amount_mxn=1200)<>1 THEN RAISE EXCEPTION 'QA: sale retry, balance or receivable'; END IF;
    BEGIN
      PERFORM erp_sell_subproduct(l,customer,'process','extra',38,1,'2026-11-24','MXN',1,'QA','qa','qa-sale-over');
      RAISE EXCEPTION 'QA: negative stock accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    IF (SELECT count(*) FROM erp_operation_events WHERE lot_id=l AND actor_id='qa')<10 THEN RAISE EXCEPTION 'QA: events missing'; END IF;
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Rollback successful test fixture';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN
    RAISE NOTICE 'QA production, packing, repacking, receivables, audit and rollback passed';
  END;
END $$;
