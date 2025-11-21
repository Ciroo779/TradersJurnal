/* Full app - ready to paste
   - Paths used:
     center photo: /mnt/data/WhatsApp Image 2025-11-21 at 20.20.46.jpeg
     full bg: /mnt/data/03e1a907-af05-441e-9dc2-d6762db0b608.png
*/

(() => {
  // DOM refs
  const loginScreen = document.getElementById('login-screen');
  const mainScreen = document.getElementById('main-screen');
  const usernameInput = document.getElementById('username-input');
  const loginBtn = document.getElementById('login-btn');
  const guestBtn = document.getElementById('guest-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userDisplay = document.getElementById('user-display');
  const depositInput = document.getElementById('deposit-input');
  const balanceInput = document.getElementById('balance-input');
  const balanceOverride = document.getElementById('balance-override');
  const tradeAmount = document.getElementById('trade-amount');
  const tradeLot = document.getElementById('trade-lot');
  const tradeDesc = document.getElementById('trade-desc');
  const addTradeBtn = document.getElementById('add-trade-btn');
  const tradesTableBody = document.querySelector('#trades-table tbody');
  const chartCanvas = document.getElementById('chart');
  const targetBtns = document.querySelectorAll('.target-btn');
  const selectedTargetEl = document.getElementById('selected-target');
  const targetFill = document.getElementById('target-fill');
  const targetText = document.getElementById('target-text');
  const progressFill = document.getElementById('target-fill');

  const importCsvBtn = document.getElementById('import-csv-btn');
  const csvFileInput = document.getElementById('csv-file');
  const exportCsvBtn = document.getElementById('export-csv-btn');

  const screenshotFiles = document.getElementById('screenshot-files');
  const galleryEl = document.getElementById('gallery');
  const processOcrBtn = document.getElementById('process-ocr-btn');
  const clearGalleryBtn = document.getElementById('clear-gallery');

  const imgModal = document.getElementById('imgModal');
  const modalImg = document.getElementById('modalImg');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const resetZoomBtn = document.getElementById('reset-zoom');
  const closeModalBtn = document.getElementById('close-modal');

  // state
  let username = null;
  let state = { deposit: 0, trades: [], target: 5000, processedScreenshots: [] };
  let chart = null;
  const tradeHashes = new Set();

  // helpers
  const keyFor = (u) => `jt_${u.toLowerCase()}`;
  function saveState(){ if(!username) return; localStorage.setItem(keyFor(username), JSON.stringify(state)); }
  function loadState(u){ const raw = localStorage.getItem(keyFor(u)); if(raw) return JSON.parse(raw); return { deposit:0, trades:[], target:5000, processedScreenshots:[] }; }
  function formatNum(n){ if(typeof n!=='number') n = Number(n) || 0; return n.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
  function calcCumBalances(){ const res=[]; let cum=Number(state.deposit)||0; for(const t of state.trades){ cum+=Number(t.amount); res.push(cum);} return res; }
  function calcBalance(){ if (balanceOverride && balanceOverride.value !== '' && !isNaN(Number(balanceOverride.value))) return Number(balanceOverride.value); const last = calcCumBalances().slice(-1)[0]; return (typeof last !== 'undefined') ? last : Number(state.deposit || 0); }
  function tradeHash(tr){ return `${Number(tr.amount).toFixed(2)}|${(tr.lot||'').toString()}|${(tr.desc||'').toString().toLowerCase()}`; }

  // UI renderers
  function renderHeader(){ userDisplay.innerHTML = `<span class="gold-label">${username}</span>`; document.getElementById('balance-display').textContent = ` • Balance: ${formatNum(calcBalance())} USDC`; }
  function renderAccount(){ depositInput.value = Number(state.deposit||0); balanceInput.value = formatNum(calcBalance()); selectedTargetEl.textContent = state.target; updateTargetProgress(); }

  function detectType(desc){ if(!desc) return ''; const d = String(desc).toLowerCase(); if(d.includes('buy')) return 'buy'; if(d.includes('sell')||d.includes('short')) return 'sell'; return ''; }

  function renderTrades(){
    tradesTableBody.innerHTML = '';
    const cum = calcCumBalances();
    state.trades.forEach((t,i) => {
      const tr = document.createElement('tr');
      const amt = Number(t.amount);
      const amtClass = amt < 0 ? 'amount-minus' : 'amount-plus';
      const type = detectType(t.desc);
      const typeHtml = type==='buy' ? `<span class="type-badge type-buy">BUY</span>` : (type==='sell' ? `<span class="type-badge type-sell">SELL</span>` : `<span class="muted small">-</span>`);
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><span class="${amtClass}">${formatNum(amt)}</span></td>
        <td>${t.lot ?? ''}</td>
        <td>${typeHtml}</td>
        <td>${t.desc ?? ''}</td>
        <td>${formatNum(cum[i] ?? state.deposit)}</td>
        <td><button data-i="${i}" class="btn ghost del-btn">Hapus</button></td>
      `;
      tradesTableBody.appendChild(tr);
    });
    document.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', e => {
      const i = Number(e.currentTarget.dataset.i);
      state.trades.splice(i,1);
      rebuildHashes();
      saveState(); refreshAll();
    }));
  }

  function rebuildHashes(){ tradeHashes.clear(); for(const t of state.trades) tradeHashes.add(tradeHash(t)); }

  // Chart.js
  function createOrUpdateChart(){
    const amounts = state.trades.map(t=>Number(t.amount));
    const cum = calcCumBalances();
    const labels = state.trades.map((_,i)=>`#${i+1}`);
    const root = getComputedStyle(document.documentElement);
    const profitGreen = root.getPropertyValue('--profit-green')?.trim() || '#2ECC71';
    const lossRed = root.getPropertyValue('--loss-red')?.trim() || '#FF5C6A';
    const barColors = amounts.map(v => v>=0 ? profitGreen : lossRed);

    if(chart){
      chart.data.labels = labels;
      chart.data.datasets[0].data = amounts;
      chart.data.datasets[0].backgroundColor = barColors;
      chart.data.datasets[1].data = cum;
      chart.update();
      return;
    }

    const ctx = chartCanvas.getContext('2d');
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type:'bar', label:'Profit/Loss per trade', data:amounts, backgroundColor:barColors, borderRadius:6, barThickness:28 },
          { type:'line', label:'Cumulative balance', data:cum, borderColor:'#C7F2E0', backgroundColor:'rgba(199,242,224,0.06)', tension:0.22, pointRadius:6, borderWidth:3 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{mode:'index', intersect:false},
        scales:{ x:{grid:{display:false}}, y:{grid:{color:'rgba(255,255,255,0.03)'} } },
        plugins:{ legend:{labels:{color:'rgba(255,255,255,0.92)'}}}
      }
    });
  }

  function updateTargetProgress(){
    const bal = calcBalance();
    const target = Number(state.target || 5000);
    const pct = Math.max(0, Math.min(100, (bal/target)*100));
    targetFill.style.width = `${pct}%`;
    targetText.textContent = `${pct.toFixed(2)}% • ${formatNum(bal)} / ${formatNum(target)}`;
  }

  function refreshAll(){ renderHeader(); renderAccount(); renderTrades(); createOrUpdateChart(); updateTargetProgress(); }

  // Manual add
  addTradeBtn.addEventListener('click', () => {
    const amt = Number(tradeAmount.value);
    const lot = tradeLot.value ? Number(tradeLot.value) : null;
    const desc = tradeDesc.value || '';
    if(tradeAmount.value==='' || isNaN(amt)){ alert('Isi amount profit/loss (contoh 200 atau -150).'); return; }
    const t = { amount: amt, lot, desc, ts: Date.now() };
    const h = tradeHash(t);
    if(tradeHashes.has(h)){ alert('Trade duplikat, tidak ditambahkan.'); return; }
    state.trades.push(t); tradeHashes.add(h); saveState(); tradeAmount.value=''; tradeLot.value=''; tradeDesc.value=''; refreshAll();
  });

  // CSV import/export
  importCsvBtn.addEventListener('click', ()=> csvFileInput.click());
  csvFileInput.addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = ev.target.result;
      const rows = txt.split(/\r?\n/).map(r=>r.trim()).filter(r=>r.length);
      let start = 0;
      const header = rows[0].split(',').map(h=>h.toLowerCase());
      if(header.includes('amount') && header.includes('lot')) start = 1;
      for(let i=start;i<rows.length;i++){
        const cols = rows[i].split(',').map(c=>c.trim());
        const amount = Number(cols[0] ?? 0);
        const lot = cols[1] ? Number(cols[1]) : null;
        const desc = cols[2] ?? '';
        if(!isNaN(amount)){
          const t = { amount, lot, desc, ts: Date.now()+i };
          const h = tradeHash(t);
          if(!tradeHashes.has(h)){ state.trades.push(t); tradeHashes.add(h); }
        }
      }
      saveState(); csvFileInput.value=''; refreshAll();
    };
    reader.readAsText(f);
  });

  exportCsvBtn.addEventListener('click', () => {
    const rows = [['amount','lot','desc','ts']];
    state.trades.forEach(t => rows.push([t.amount, t.lot ?? '', t.desc ?? '', t.ts]));
    const txt = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([txt],{type:'text/csv'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${username||'journal'}_trades.csv`; a.click(); URL.revokeObjectURL(url);
  });

  // login/logout
  loginBtn.addEventListener('click', () => {
    const u = (usernameInput.value||'').trim(); if(!u){ alert('Masukkan username dulu'); return; }
    username = u; state = loadState(username); state.processedScreenshots = state.processedScreenshots || []; rebuildHashes();
    loginScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); targetBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.val) === Number(state.target)));
    refreshAll();
  });
  guestBtn.addEventListener('click', () => {
    username = 'guest'; state = loadState(username); state.processedScreenshots = state.processedScreenshots || []; rebuildHashes();
    loginScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); refreshAll();
  });
  logoutBtn.addEventListener('click', ()=> { username=null; loginScreen.classList.remove('hidden'); mainScreen.classList.add('hidden'); usernameInput.value=''; });

  depositInput.addEventListener('change', ()=> { state.deposit = Number(depositInput.value || 0); saveState(); refreshAll(); });
  balanceOverride.addEventListener('input', ()=> { balanceInput.value = formatNum(calcBalance()); renderHeader(); });

  // targets
  targetBtns.forEach(btn => btn.addEventListener('click', () => {
    targetBtns.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    state.target = Number(btn.dataset.val); saveState(); refreshAll();
  }));

  // OCR parsing heuristics
  function parseTextToTrades(text){
    const lines = text.split(/[\r\n,;]/).map(r=>r.trim()).filter(Boolean);
    const found = [];
    for(const line of lines){
      const amtMatch = line.match(/(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:\.\d+)?)/);
      if(!amtMatch) continue;
      let raw = amtMatch[0].replace(/\./g,'').replace(/,/g,'.');
      const amount = Number(raw);
      if(isNaN(amount)) continue;
      let lot = null;
      const lotMatch = line.match(/lot\s*[:=]?\s*([0-9]*\.?[0-9]+)/i) || line.match(/([0-9]*\.?[0-9]+)\s*lot/i);
      if(lotMatch) lot = Number(lotMatch[1]);
      else {
        const m = line.match(/x\s*([0-9]*\.?[0-9]+)/i) || line.match(/([0-9]*\.?[0-9]+)\s*x/i);
        if(m) lot = Number(m[1]);
      }
      let type = '';
      if(/buy|long/.test(line)) type = 'buy';
      if(/sell|short/.test(line)) type = 'sell';
      const desc = line;
      found.push({ amount, lot, desc, type });
    }
    return found;
  }

  // gallery helpers
  function addThumb(file, objectUrl){
    const id = `${file.name}_${file.size}_${file.lastModified}`;
    const div = document.createElement('div'); div.className='thumb'; div.dataset.id = id; div.dataset.src = objectUrl;
    const img = document.createElement('img'); img.src = objectUrl;
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = file.name;
    const del = document.createElement('button'); del.className='del-btn'; del.type='button'; del.title='Hapus'; del.textContent='Hapus';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if(state.processedScreenshots && Array.isArray(state.processedScreenshots)){
        const idx = state.processedScreenshots.indexOf(id);
        if(idx !== -1){ state.processedScreenshots.splice(idx,1); saveState(); }
      }
      try{ URL.revokeObjectURL(objectUrl);}catch(e){}
      div.remove();
    });
    div.appendChild(img); div.appendChild(meta); div.appendChild(del);
    galleryEl.prepend(div);
    div.addEventListener('click', ()=> openModal(objectUrl));
    return id;
  }

  async function processImageFile(file, objectUrl){
    const id = `${file.name}_${file.size}_${file.lastModified}`;
    if(state.processedScreenshots && state.processedScreenshots.includes(id)) return [];
    try{
      const worker = Tesseract.createWorker({ logger: m => {} });
      await worker.load(); await worker.loadLanguage('eng'); await worker.initialize('eng');
      const { data: { text } } = await worker.recognize(objectUrl);
      await worker.terminate();
      const trades = parseTextToTrades(text);
      state.processedScreenshots = state.processedScreenshots || [];
      state.processedScreenshots.push(id);
      saveState();
      return trades;
    }catch(err){
      console.warn('OCR failed', err); return [];
    }
  }

  function addTradesFromParsing(foundTrades){
    let added = 0;
    for(const t0 of foundTrades){
      const t = { amount: Number(t0.amount), lot: t0.lot ? Number(t0.lot) : null, desc: (t0.type? t0.type + (t0.desc? ' / '+t0.desc: '') : t0.desc), ts: Date.now() };
      const h = tradeHash(t);
      if(!tradeHashes.has(h)){ state.trades.push(t); tradeHashes.add(h); added++; }
    }
    if(added){ saveState(); refreshAll(); }
    return added;
  }

  // handle uploads
  screenshotFiles.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for(const file of files){
      const objectUrl = URL.createObjectURL(file);
      const id = addThumb(file, objectUrl);
      processImageFile(file, objectUrl).then(found => {
        if(found && found.length){ const added = addTradesFromParsing(found); if(added) console.log(`OCR added ${added} trades from ${file.name}`); }
      }).catch(()=>{});
    }
    screenshotFiles.value = '';
  });

  // manual OCR for gallery
  processOcrBtn.addEventListener('click', async () => {
    const thumbs = Array.from(galleryEl.querySelectorAll('.thumb'));
    for(const thumb of thumbs){
      const img = thumb.querySelector('img');
      const id = thumb.dataset.id;
      if(state.processedScreenshots && state.processedScreenshots.includes(id)) continue;
      try{
        const resp = await fetch(img.src); const blob = await resp.blob();
        const file = new File([blob], id + '.png', { type: blob.type });
        const trades = await processImageFile(file, img.src);
        if(trades && trades.length) addTradesFromParsing(trades);
      }catch(e){ console.warn(e); }
    }
  });

  // clear gallery
  clearGalleryBtn.addEventListener('click', ()=> {
    const thumbs = Array.from(galleryEl.querySelectorAll('.thumb'));
    thumbs.forEach(t => {
      const src = t.dataset.src; if(src) try{ URL.revokeObjectURL(src); }catch(e){}
      t.remove();
    });
    state.processedScreenshots = []; saveState();
  });

  // modal (zoom + drag)
  let scale=1, translateX=0, translateY=0, isDragging=false, lastClientX=0, lastClientY=0;
  function openModal(src){ modalImg.src = src; scale=1; translateX=0; translateY=0; applyTransform(); imgModal.classList.remove('hidden'); }
  function closeModal(){ imgModal.classList.add('hidden'); modalImg.src=''; }
  function applyTransform(){ modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`; }

  zoomInBtn.addEventListener('click', ()=> { scale = Math.min(6, scale + 0.25); applyTransform(); });
  zoomOutBtn.addEventListener('click', ()=> { scale = Math.max(0.5, scale - 0.25); applyTransform(); });
  resetZoomBtn.addEventListener('click', ()=> { scale=1; translateX=0; translateY=0; applyTransform(); });
  closeModalBtn.addEventListener('click', closeModal);

  const imgWrap = document.querySelector('.img-wrap');
  imgWrap.addEventListener('pointerdown', (e)=> { isDragging=true; lastClientX=e.clientX; lastClientY=e.clientY; imgWrap.setPointerCapture(e.pointerId); imgWrap.style.cursor='grabbing'; });
  imgWrap.addEventListener('pointermove', (e)=> { if(!isDragging) return; const dx = e.clientX - lastClientX; const dy = e.clientY - lastClientY; translateX += dx; translateY += dy; lastClientX=e.clientX; lastClientY=e.clientY; applyTransform(); });
  imgWrap.addEventListener('pointerup', (e)=> { isDragging=false; try{ imgWrap.releasePointerCapture(e.pointerId);}catch(e){} imgWrap.style.cursor='grab'; });
  imgWrap.addEventListener('wheel', (e)=> { e.preventDefault(); const delta = -e.deltaY || e.wheelDelta; if(delta>0) scale = Math.min(6, scale*1.08); else scale = Math.max(0.5, scale/1.08); applyTransform(); });

  // window resize chart
  window.addEventListener('resize', ()=> { if(chart) chart.resize(); });

  // init
  (function init(){ /* wait for login */ })();

  // save on unload
  window.addEventListener('beforeunload', ()=> { if(username) saveState(); });

})();
