import * as XLSX from 'xlsx';

export async function templateBytes(url) {
  const response = await fetch(url,{cache:'no-store'});
  if (!response.ok) throw new Error('La plantilla guardada no se pudo abrir.');
  return new Uint8Array(await response.arrayBuffer());
}

export async function validateShipmentTemplate(file,type) {
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo debe pesar 10 MB o menos.');
  const data = new Uint8Array(await file.arrayBuffer());
  if (type==='pdf_template_url') {
    const {PDFDocument} = await import('pdf-lib');
    const pdf = await PDFDocument.load(data);
    if (!pdf.getPageCount()) throw new Error('El PDF está vacío.');
  } else if (type==='pallet_template_url') {
    if (!imageFormat(data)) throw new Error('Selecciona una imagen JPG o PNG.');
    const {jsPDF} = await import('jspdf');
    try {new jsPDF().getImageProperties(data);} catch {throw new Error('No se pudo abrir la imagen.');}
  } else {
    if (!/\.xlsx?$/i.test(file.name) || !XLSX.read(data,{type:'array'}).SheetNames.length) {
      throw new Error('Selecciona una plantilla Excel válida.');
    }
  }
}

function imageFormat(bytes) {
  if ([137,80,78,71,13,10,26,10].every((code,i)=>bytes[i]===code)) return 'PNG';
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'JPEG';
  return null;
}

const text = value => String(value ?? '');
const money = value => Number(value || 0).toFixed(2);

export async function buildSalesNote({folio,customer,driver,date,currency,rows,notes,company,destination,plates},settings) {
  if (!rows.length) throw new Error('La nota todavía no tiene partidas.');
  const {jsPDF} = await import('jspdf');
  const doc = new jsPDF({unit:'pt',format:'letter'});
  const top = Math.min(200,Math.max(20,Number(settings.pdf_top_margin) || 78));
  const currencyLabel = currency || 'USD';
  const front = () => {
    let y = settings.pdf_template_url ? top : 38;
    doc.setTextColor(2,77,50);
    doc.setFontSize(17);
    doc.setFont('helvetica','bold');
    doc.text('Nota de venta',34,y);
    doc.setFontSize(10);
    doc.text(text(folio || 'Borrador'),578,y,{align:'right'});
    doc.setFont('helvetica','normal');
    doc.setTextColor(25,44,35);
    y += 16;
    doc.text([text(company),text(date),currencyLabel].filter(Boolean).join(' · '),34,y);
    y += 15;
    doc.text(doc.splitTextToSize(`Cliente: ${customer || '—'} · Chofer: ${driver || '—'}`,540),34,y);
    y += 21;
    doc.text(doc.splitTextToSize(`Destino: ${destination || '—'} · Tráiler: ${plates || '—'}`,540),34,y);
    y += 24;
    doc.setFillColor(231,243,234);
    doc.rect(32,y-11,548,16,'F');
    const columns = [35,271,332,387,480,577];
    ['Producto / presentación','Tarimas','Cajas','Kg','Precio un.','Importe'].forEach((heading,i)=>
      doc.text(heading,columns[i],y,{align:i>0?'right':'left'}));
    return y+17;
  };
  let y=front();
  rows.forEach(row=>{
    if (y>690) {doc.addPage();y=front();}
    const name = doc.splitTextToSize((row.producto || '') + (row.presentacion ? ' · ' + row.presentacion : ''),195);
    doc.text(name,35,y);
    [row.tarimas,row.cajas,row.kg,money(row.precio),money(row.total)].forEach((value,i)=>{
      doc.text(text(value),[271,332,387,480,577][i],y,{align:'right'});
    });
    y += Math.max(17,name.length*13);
  });
  if (y>695) {doc.addPage();y=front();}
  doc.setFont('helvetica','bold');
  const total = rows.reduce((sum,row)=>sum+Math.round(Number(row.total||0)*100),0)/100;
  doc.text(`Total ${currencyLabel}  ${money(total)}`,577,y+10,{align:'right'});
  doc.setFont('helvetica','normal');
  if (notes) doc.text(doc.splitTextToSize(text(notes).slice(0,380),542),34,y+27);
  doc.setFontSize(8);
  doc.text('Firma empacadora / chofer ___________________',34,762);
  doc.text('Recibe cliente ___________________',578,762,{align:'right'});

  const foreground = new Uint8Array(doc.output('arraybuffer'));
  if (!settings.pdf_template_url) return foreground;
  const {PDFDocument} = await import('pdf-lib');
  const output = await PDFDocument.create();
  const template = await templateBytes(settings.pdf_template_url);
  const [background] = await output.embedPdf(template,[0]);
  const topPages = await PDFDocument.load(foreground);
  for (const overlay of await output.embedPages(topPages.getPages())) {
    const page = output.addPage([612,792]);
    const scale = Math.min(612/background.width,792/background.height);
    const width = background.width*scale, height = background.height*scale;
    page.drawPage(background,{x:(612-width)/2,y:(792-height)/2,width,height});
    page.drawPage(overlay,{x:0,y:0,width:612,height:792});
  }
  return output.save();
}

export async function buildPalletSlips(rows,imageUrl,plates) {
  if (!rows.length) throw new Error('Agrega tarimas al tráiler para imprimir papeletas.');
  const {jsPDF} = await import('jspdf');
  const doc = new jsPDF({unit:'mm',format:[80,105]});
  const image = imageUrl ? await templateBytes(imageUrl) : null;
  const format = image && imageFormat(image);
  if (image && !format) throw new Error('La plantilla de papeletas no es JPG o PNG.');
  rows.forEach((row,index)=>{
    if (index) doc.addPage([80,105]);
    let y=9;
    if (image) {
      const spec=doc.getImageProperties(image);
      const scale=Math.min(70/spec.width,28/spec.height);
      doc.addImage(image,format,(80-spec.width*scale)/2,4,spec.width*scale,spec.height*scale,'papeleta');
      y=38;
    }
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('Papeleta de tarima',5,y);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);
    const lines=[
      `Tarima: ${row.folio || '—'} · Posición: ${row.position || '—'}`,
      `Lote: ${row.lot_number || '—'}`,`Calibre: ${row.caliber || '—'} · Clase: ${row.class_name || '—'}`,
      `Fecha de frío: ${row.cold_date || '—'}`,`Cajas: ${row.boxes || 0} · Kg: ${row.kilos || 0}`,
      `Tráiler: ${plates || '—'}`
    ];
    doc.text(lines.flatMap(line=>doc.splitTextToSize(line,70)),5,y+6,{lineHeightFactor:1.35});
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

export function presentPdf(data,name,popup) {
  const url = URL.createObjectURL(new Blob([data],{type:'application/pdf'}));
  if (popup) popup.location.replace(url);
  else {
    const a=document.createElement('a');
    a.href=url;a.download=name;a.click();
  }
  window.setTimeout(()=>URL.revokeObjectURL(url),120000);
}

export async function exportSalesNoteExcel(note,url) {
  const labels = ['PRODUCTO','PRESENTACIÓN','TARIMAS','CAJAS','KILOS','PRECIO UN','TOTAL'];
  const workbook = url ? XLSX.read(await templateBytes(url),{type:'array',cellStyles:true}) : XLSX.utils.book_new();
  if (!workbook.SheetNames.length) XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([]),'Nota de venta');
  const name = workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  const normalized = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const aliases = [['PRODUCTO','DESCRIPCION'],['PRESENTACION','PRES.'],['TARIMAS','TAR.'],['CAJAS'],['KILOS','KG'],['PRECIO UN','PRECIO UNITARIO','PRECIO'],['TOTAL','IMPORTE']];
  const found = new Map();
  const meta = {CLIENTE:note.customer,FECHA:note.date,FOLIO:note.folio,MONEDA:note.currency};
  for (const [address,cell] of Object.entries(sheet)) {
    if (!/^[A-Z]+\d+$/.test(address)) continue;
    const position = XLSX.utils.decode_cell(address);
    const label = normalized(cell.v);
    if (Object.hasOwn(meta,label)) {
      const dest=XLSX.utils.encode_cell({r:position.r,c:position.c+1});
      if (!sheet[dest]?.v) XLSX.utils.sheet_add_aoa(sheet,[[meta[label]]],{origin:dest});
    }
    const slot = aliases.findIndex(names=>names.includes(label));
    if (slot>=0) {
      const columns = found.get(position.r) || [];
      columns[slot]=position.c;
      found.set(position.r,columns);
    }
  }
  const recognized = [...found].find(([,columns])=>columns.filter(Number.isInteger).length===labels.length);
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  const header = recognized?.[0] ?? (range ? range.e.r+3 : 4);
  const columns = recognized?.[1] || labels.map((_,index)=>index);
  if (!recognized) {
    XLSX.utils.sheet_add_aoa(sheet,[['FOLIO',note.folio,'CLIENTE',note.customer],
      ['FECHA',note.date,'MONEDA',note.currency]],{origin:{r:header-3,c:0}});
    XLSX.utils.sheet_add_aoa(sheet,[labels],{origin:{r:header,c:0}});
  }
  const rows = note.rows.map(row=>[row.producto,row.presentacion,Number(row.tarimas),
    Number(row.cajas),Number(row.kg),Number(row.precio),Number(row.total)]);
  rows.push(['TOTAL','','','','','',rows.reduce((total,row)=>total+Math.round(row[6]*100),0)/100]);
  rows.forEach((row,index)=>row.forEach((value,col)=>{
    const address=XLSX.utils.encode_cell({r:header+1+index,c:columns[col]});
    const style=sheet[address]?.s;
    XLSX.utils.sheet_add_aoa(sheet,[[value]],{origin:address});
    if (style && sheet[address]) sheet[address].s=style;
  }));
  XLSX.writeFile(workbook,`nota_venta_${note.folio || 'borrador'}.xlsx`);
}
