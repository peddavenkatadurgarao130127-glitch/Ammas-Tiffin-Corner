const { randomUUID } = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_PASSCODE = process.env.OWNER_PASSCODE;
const TABLE = 'orders';
const STATUSES = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Completed'];
const MENU = {
  'Idly (plate of 4)': 40,
  'Poori (plate of 4)': 50,
  'Gari (plate of 3)': 35,
  'Mysore Bajji (plate)': 30,
};

function json(res, status, body){
  res.status(status).setHeader('Content-Type','application/json').send(JSON.stringify(body));
}
function checkConfig(res){
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OWNER_PASSCODE){
    json(res, 500, {error:'Backend is not configured. Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OWNER_PASSCODE in Vercel Environment Variables.'});
    return false;
  }
  return true;
}
async function db(path, options={}){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers||{})
    }
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error(data?.message || data?.hint || `Database error (${r.status})`);
  return data;
}
function owner(req){ return req.headers['x-owner-token'] === `owner:${OWNER_PASSCODE}`; }
function publicOrder(row){
  return {
    id: row.id, items: row.items, total: Number(row.total), fulfillment: row.fulfillment,
    customerName: row.customer_name, phone: row.phone, address: row.address || '', notes: row.notes || '',
    status: row.status, paymentStatus: row.payment_status, createdAt: row.created_at
  };
}

module.exports = async (req,res) => {
  if (!checkConfig(res)) return;
  try {
    if (req.method === 'GET') {
      const id = typeof req.query?.id === 'string' ? req.query.id : null;
      if (id) {
        const rows = await db(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`);
        if (!rows.length) return json(res,404,{error:'Order not found'});
        return json(res,200,{order:publicOrder(rows[0])});
      }
      if (!owner(req)) return json(res,401,{error:'Owner authentication required'});
      const rows = await db(`${TABLE}?select=*&order=created_at.desc`);
      const orders = Object.fromEntries(rows.map(r => [r.id, publicOrder(r)]));
      return json(res,200,{orders});
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.customerName || !b.phone || !Array.isArray(b.items) || !b.items.length) return json(res,400,{error:'Name, phone and at least one item are required.'});
      if (!['Pickup','Delivery'].includes(b.fulfillment)) return json(res,400,{error:'Invalid fulfillment mode.'});
      if (b.fulfillment === 'Delivery' && !b.address) return json(res,400,{error:'Delivery address is required.'});
      const items = b.items.map(it => {
        const price = MENU[it.name];
        const qty = Number(it.qty);
        if (!price || !Number.isInteger(qty) || qty < 1 || qty > 50) throw new Error(`Invalid menu item or quantity: ${it.name}`);
        return {name:it.name, qty, price};
      });
      const total = items.reduce((sum,it)=>sum + it.qty*it.price,0);
      const d = new Date();
      const prefix = `ATC${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-`;
      let id;
      for (let i=0;i<10;i++){
        id = prefix + Math.floor(100 + Math.random()*900);
        const existing = await db(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=id`);
        if (!existing.length) break;
      }
      const rows = await db(TABLE, {method:'POST', body:JSON.stringify({
        id, items, total, fulfillment:b.fulfillment, customer_name:String(b.customerName).slice(0,100),
        phone:String(b.phone).slice(0,30), address:String(b.address||'').slice(0,300), notes:String(b.notes||'').slice(0,500),
        status:'Placed', payment_status:'Unpaid'
      })});
      return json(res,201,{order:publicOrder(rows[0])});
    }

    if (req.method === 'PATCH') {
      const id = typeof req.query?.id === 'string' ? req.query.id : String(req.body?.id||'');
      const isCustomerPayment = req.query?.customerPayment === '1';
      if (!id) return json(res,400,{error:'Order ID required'});
      const patch = {};
      if (isCustomerPayment) {
        if (req.body?.paymentStatus !== 'Claimed') return json(res,400,{error:'Invalid payment status'});
        patch.payment_status = 'Claimed';
      } else {
        if (!owner(req)) return json(res,401,{error:'Owner authentication required'});
        if (req.body?.status && STATUSES.includes(req.body.status)) patch.status = req.body.status;
        if (req.body?.paymentStatus === 'Paid') patch.payment_status = 'Paid';
        if (!Object.keys(patch).length) return json(res,400,{error:'No valid update supplied'});
      }
      const rows = await db(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {method:'PATCH', body:JSON.stringify(patch)});
      if (!rows.length) return json(res,404,{error:'Order not found'});
      return json(res,200,{order:publicOrder(rows[0])});
    }
    res.setHeader('Allow','GET,POST,PATCH');
    return json(res,405,{error:'Method not allowed'});
  } catch(e){ console.error(e); return json(res,500,{error:e.message || 'Server error'}); }
};
