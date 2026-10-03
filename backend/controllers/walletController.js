const crypto = require('crypto');
const walletModel = require('../models/walletModel');
const topupModel = require('../models/topupModel');
const { asyncHandler } = require('../middleware/errorHandler');


function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function tlv(id, value) { return `${id}${String(value.length).padStart(2,'0')}${value}`; }
function normalizePromptPayId(value) {
  const raw = String(value || '').replace(/[^0-9]/g, '');
  if (/^0\d{9}$/.test(raw)) return `0066${raw.slice(1)}`;
  if (/^66\d{9}$/.test(raw)) return `00${raw}`;
  if (/^\d{13}$/.test(raw)) return raw;
  return null;
}
function promptPayPayload(id, amount, reference) {
  const target = normalizePromptPayId(id);
  if (!target) return null;
  const targetTag = target.length === 13 ? tlv('02', target) : tlv('01', target);
  const merchant = tlv('29', tlv('00', 'A000000677010111') + targetTag);
  const body = tlv('00', '01') + merchant + tlv('52', '0000') + tlv('53', '764') + tlv('54', Number(amount).toFixed(2)) + tlv('58', 'TH') + tlv('59', 'SUNFLOWERPC') + tlv('60', 'PHAYAO') + tlv('62', tlv('07', String(reference).slice(0,25)));
  return body + '6304' + crc16(body + '6304');
}

function ref() { return `TP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`; }

const getWallet = asyncHandler(async (req,res)=>{
  const wallet=await walletModel.findByCustomerId(req.user.customerId);
  const transactions=await walletModel.listTransactions(wallet.wallet_id);
  res.json({walletId:wallet.wallet_id,balance:Number(wallet.balance),transactions});
});

const topup = asyncHandler(async (req,res)=>{
  const amount=Number(req.body.amount);
  if(!Number.isFinite(amount)||amount<10||amount>100000) return res.status(400).json({message:'จำนวนเงินต้องอยู่ระหว่าง 10 - 100,000 บาท'});
  await topupModel.expireOld();
  const payment=await topupModel.create(req.user.customerId,amount,ref(),new Date(Date.now()+5*60*1000));
  res.status(201).json({
    message:'สร้างรายการเติมเงินแล้ว กรุณาโอนตาม QR ภายใน 5 นาที',
    payment:{
      topupId:payment.topup_id,
      amount:Number(payment.amount),
      referenceCode:payment.reference_code,
      status:payment.status,
      qrUrl: (() => { const payload = promptPayPayload(process.env.PROMPTPAY_ID, Number(payment.amount), payment.reference_code); return process.env.PAYMENT_QR_URL || (payload ? `https://quickchart.io/qr?size=360&margin=2&text=${encodeURIComponent(payload)}` : '/assets/payment-qr.png'); })(),
      expiresAt:payment.expires_at
    }
  });
});

const topupStatus=asyncHandler(async(req,res)=>{
  await topupModel.expireOld();
  const p=await topupModel.findById(req.params.id,req.user.customerId);
  if(!p)return res.status(404).json({message:'ไม่พบรายการเติมเงิน'});
  res.json({payment:{topupId:p.topup_id,amount:Number(p.amount),referenceCode:p.reference_code,status:p.status,expiresAt:p.expires_at,paidAt:p.paid_at}});
});

const topupHistory=asyncHandler(async(req,res)=>{
  res.json({topups:await topupModel.listByCustomer(req.user.customerId)});
});

const confirmTopup=asyncHandler(async(req,res)=>{
  const result=await topupModel.confirm(req.params.id,req.user.customerId);
  res.json({success:result.success,payment:{topupId:result.payment.topup_id,amount:Number(result.payment.amount),status:result.payment.status}});
});

const cancelTopup=asyncHandler(async(req,res)=>{
  const payment=await topupModel.cancel(req.params.id,req.user.customerId);
  res.json({success:true,payment:{topupId:payment.topup_id,amount:Number(payment.amount),status:payment.status}});
});

// Called by a real payment-verification provider. It must send the shared secret.
const paymentWebhook=asyncHandler(async(req,res)=>{
  const expected=process.env.PAYMENT_WEBHOOK_SECRET;
  if(!expected) return res.status(503).json({message:'ยังไม่ได้ตั้งค่า PAYMENT_WEBHOOK_SECRET'});
  const provided=req.get('x-payment-secret') || req.body.secret;
  if(provided!==expected) return res.status(401).json({message:'Unauthorized'});
  const referenceCode=String(req.body.referenceCode || req.body.reference_code || '').trim();
  const amount=Number(req.body.amount);
  if(!referenceCode || !Number.isFinite(amount)) return res.status(400).json({message:'referenceCode และ amount จำเป็น'});
  const payment=await topupModel.markPaidByReference(referenceCode,amount);
  res.json({ok:true,status:payment.status,topupId:payment.topup_id});
});

module.exports={getWallet,topup,topupStatus,topupHistory,confirmTopup,cancelTopup,paymentWebhook};
