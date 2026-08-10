const crypto = require('crypto');
module.exports = async (req,res) => {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const expected = process.env.OWNER_PASSCODE;
  if (!expected) return res.status(500).json({error:'OWNER_PASSCODE is not configured'});
  const passcode = String(req.body?.passcode || '');
  const a = Buffer.from(passcode); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'Invalid passcode'});
  return res.status(200).json({token:`owner:${expected}`});
};
