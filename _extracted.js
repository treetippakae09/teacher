
  /* ================= mobile: rotate-to-landscape prompt ================= */
  // the whole site is built around wide, landscape photos (door/desk/dream
  // scenes), so a phone held upright in portrait squashes everything. Tablets
  // are usually fine in portrait too (more width to work with), so this only
  // triggers for genuinely phone-sized screens (using the shorter of the two
  // viewport dimensions as the "is this a phone" check, which stays correct
  // whichever way the phone is currently held).
  const orientationOverlay = document.getElementById('orientationOverlay');
  const warpFlash = document.getElementById('warpFlash');
  function checkOrientation(){
    const isPhoneSize = Math.min(window.innerWidth, window.innerHeight) <= 540;
    const isPortrait   = window.innerHeight > window.innerWidth;
    orientationOverlay.classList.toggle('show', isPhoneSize && isPortrait);
  }
  checkOrientation();
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);

  const hint       = document.getElementById('hint');
  const intro      = document.getElementById('intro');
  const enterBtn   = document.getElementById('enterBtn');
  const startLayer = document.getElementById('startLayer');
  const lightBurst = document.getElementById('lightBurst');
  const doorImgWrap = document.querySelector('.door-img-wrap');
  const doorBob     = document.getElementById('doorBob');
  const reachHand   = document.getElementById('reachHand');
  const questionLayer = document.getElementById('questionLayer');
  const questionText  = document.getElementById('questionText');
  const nextBtn       = document.getElementById('nextBtn');
  const answerLayer   = document.getElementById('answerLayer');
  const answerInput   = document.getElementById('answerInput');
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  const answerNote    = document.getElementById('answerNote');
  const QUESTION = 'ภาระงานอื่นของครู งานไหน? /ที่ทำให้คุณเหนื่อยหรือท้อแท้ใจมากที่สุด';

  // the 15 checklist activities, in the same order as the checklist HTML -
  // shared between the visitor checklist (stores the Thai text) and the
  // admin's card rules (stores/matches the short ch1..ch15 codes instead,
  // since codes are more robust to work with than long Thai strings).
  const ACTIVITY_LIST = [
    'เตรียมการสอน','ใช้เวลากับครอบครัว','ไปเที่ยว','ไปคาเฟ่','อ่านหนังสือ',
    'ปลูกต้นไม้','ตกแต่งบ้านและสวน','เดินป่า/ปีนเขา','เข้าวัดทำบุญ','ไปทะเล/ดำน้ำดูปะการัง',
    'ทำอาหาร','พบปะสังสรรค์กับเพื่อน','นอน','วาดภาพ','เรียนต่อ'
  ];
  function activityCode(name){
    const idx = ACTIVITY_LIST.indexOf(name);
    return idx === -1 ? name : ('ch' + (idx + 1));
  }

  /* ================= footstep + knock sounds, door sequence ================= */
  let audioCtx;
  function ensureAudio(){
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function playFootstepSound(){
    if(!audioCtx) return;
    const t0 = audioCtx.currentTime;
    // soft low heel thud
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t0);
    osc.frequency.exponentialRampToValueAtTime(58, t0 + 0.09);
    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.32, t0);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    osc.connect(oscGain).connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + 0.15);

    // soft shoe-tap texture
    const bufferSize = audioCtx.sampleRate * 0.04;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * Math.pow(1 - i/bufferSize, 4); }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const band = audioCtx.createBiquadFilter();
    band.type = 'bandpass'; band.frequency.value = 1500; band.Q.value = 0.8;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.22, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    noise.connect(band).connect(noiseGain).connect(audioCtx.destination);
    noise.start(t0); noise.stop(t0 + 0.06);
  }
  function doFootstepSequence(times, gap, onDone, onStep){
    let count = 0;
    const step = ()=>{
      playFootstepSound();
      count++;
      if(onStep) onStep(count);
      if(count < times){ setTimeout(step, gap); }
      else if(onDone){ setTimeout(onDone, gap); }
    };
    step();
  }

  /* ---- door unlocking sound, played as the hand reaches for the knob ---- */
  function playDoorUnlockSound(){
    if(!audioCtx) return;
    const t0 = audioCtx.currentTime;
    // two soft mechanical clicks, like a key turning
    [0, 0.22].forEach(offset=>{
      const t = t0 + offset;
      const bufferSize = audioCtx.sampleRate * 0.03;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * Math.pow(1 - i/bufferSize, 3); }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const band = audioCtx.createBiquadFilter();
      band.type = 'bandpass'; band.frequency.value = 1800; band.Q.value = 2.5;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(band).connect(gain).connect(audioCtx.destination);
      noise.start(t); noise.stop(t + 0.06);
    });
    // then a soft low "thunk" as the latch releases
    const t2 = t0 + 0.42;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t2);
    osc.frequency.exponentialRampToValueAtTime(90, t2 + 0.12);
    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.3, t2);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.18);
    osc.connect(oscGain).connect(audioCtx.destination);
    osc.start(t2); osc.stop(t2 + 0.2);
  }

  /* ---- typewriter question + typing sound ---- */
  function playTypeTick(){
    if(!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const freq = 2200 + Math.random()*900;
    const bufferSize = audioCtx.sampleRate * 0.02;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * Math.pow(1 - i/bufferSize, 5); }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const band = audioCtx.createBiquadFilter();
    band.type = 'bandpass'; band.frequency.value = freq; band.Q.value = 4;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.18, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.025);
    noise.connect(band).connect(gain).connect(audioCtx.destination);
    noise.start(t0); noise.stop(t0 + 0.03);
  }

  /* ---- synthesized phone ring (page 8) ---- */
  function playRingChirp(startAt){
    if(!audioCtx) return;
    // a quick two-tone trill, like a classic ringtone burst
    [0, 0.09, 0.18, 0.27].forEach((offset, i)=>{
      const t = startAt + offset;
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = (i % 2 === 0) ? 1000 : 1400;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.09);
    });
  }
  function doRingSequence(times, gap, onDone){
    if(!audioCtx){ if(onDone) setTimeout(onDone, 0); return; }
    let count = 0;
    const step = ()=>{
      playRingChirp(audioCtx.currentTime);
      count++;
      if(count < times){ setTimeout(step, gap); }
      else if(onDone){ setTimeout(onDone, gap); }
    };
    step();
  }

  function cursorEl(){
    const s = document.createElement('span');
    s.className = 'cursor';
    return s;
  }
  function resetTextEl(el){
    el.innerHTML = '';
    el.appendChild(cursorEl());
  }
  function resetQuestionText(){ resetTextEl(questionText); }

  // "/" in the source string marks a line break between typed segments.
  // Works on ANY element (el), so it's reused for the door question, the
  // desk-scene messages, and the name typed onto the nameplate.
  //
  // IMPORTANT: each line's growing text lives in ONE single Text node whose
  // value we overwrite with the full substring typed so far (nodeValue =
  // part.slice(0, charIdx)). We do NOT insert one brand-new Text node per
  // character - Thai vowels/tone marks (ั ่ ้ ึ ื) are combining characters
  // that need to be shaped together with the base consonant. Splitting them
  // across separate sibling Text nodes (the previous approach) left tone
  // marks with no base character in their own node to attach to, so they
  // silently failed to render - that's the "vowels disappearing" bug.
  function typeTextInto(el, text, speed, onDone){
    const parts = text.split('/').map(p => p.trim());
    resetTextEl(el);
    const cursor = el.querySelector('.cursor');
    let partIdx = 0, charIdx = 0;
    let currentNode = document.createTextNode('');
    el.insertBefore(currentNode, cursor);

    const step = ()=>{
      if(partIdx >= parts.length){
        if(onDone) setTimeout(onDone, 1400);
        return;
      }
      const part = parts[partIdx];
      if(charIdx < part.length){
        charIdx++;
        currentNode.nodeValue = part.slice(0, charIdx);
        if(part[charIdx-1] !== ' '){ playTypeTick(); }
      } else {
        partIdx++; charIdx = 0;
        if(partIdx < parts.length){
          el.insertBefore(document.createElement('br'), cursor);
          currentNode = document.createTextNode('');
          el.insertBefore(currentNode, cursor);
        }
      }
      setTimeout(step, speed);
    };
    step();
  }
  function typeQuestion(text, speed, onDone){ typeTextInto(questionText, text, speed, onDone); }

  // escape untrusted values (Name1, Answer1, ...) before dropping them into innerHTML
  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // Like typeTextInto, but for messages that need a variable's value (Name1,
  // Answer1, Answer2, ...) highlighted in a different color from the rest of
  // the sentence. `segments` is an array of parts typed in order, e.g.:
  //   [{text:'งาน '}, {text:answer1Value, className:'var-highlight'}, {text:' หนัก...'}, {br:true}, {text:'บรรทัดถัดไป'}]
  // Each segment gets its own single Text node (same reasoning as
  // typeTextInto - keeps Thai vowels/tone marks intact), optionally wrapped
  // in a <span> for the highlight color. {br:true} inserts a line break
  // instead of typing anything.
  function typeSegments(el, segments, speed, onDone){
    resetTextEl(el);
    const cursor = el.querySelector('.cursor');
    let segIdx = -1, charIdx = 0, currentNode = null;

    function startNextSegment(){
      segIdx++;
      if(segIdx >= segments.length) return false;
      const seg = segments[segIdx];
      if(seg.br){
        el.insertBefore(document.createElement('br'), cursor);
        return startNextSegment();
      }
      charIdx = 0;
      currentNode = document.createTextNode('');
      if(seg.className){
        const span = document.createElement('span');
        span.className = seg.className;
        span.appendChild(currentNode);
        el.insertBefore(span, cursor);
      } else {
        el.insertBefore(currentNode, cursor);
      }
      return true;
    }
    startNextSegment();

    const step = ()=>{
      if(segIdx >= segments.length){
        if(onDone) setTimeout(onDone, 1400);
        return;
      }
      const seg = segments[segIdx];
      if(charIdx < seg.text.length){
        charIdx++;
        currentNode.nodeValue = seg.text.slice(0, charIdx);
        if(seg.text[charIdx-1] !== ' '){ playTypeTick(); }
      } else if(!startNextSegment()){
        if(onDone) setTimeout(onDone, 1400);
        return;
      }
      setTimeout(step, speed);
    };
    step();
  }

  // fades .hint's current text out (instead of an instant textContent=''
  // cut), clears it, restores its default resting opacity, then runs onDone
  function fadeOutHint(onDone){
    hint.style.opacity = '0';
    setTimeout(()=>{
      hint.textContent = '';
      hint.style.opacity = '';
      if(onDone) onDone();
    }, 400); // matches .hint's opacity transition
  }

  // Walking bob + 4 footstep sounds, with the door image gradually, smoothly
  // pushing in a little more on EVERY footstep (rather than one big zoom
  // right at the end), then the enter button fades in - fully automatic,
  // no click needed to start any of it. NOTE: because there's been no user
  // gesture yet at page-load time, browsers block Web Audio output, so the
  // 4 footstep sounds may play silently on a visitor's very first cold load
  // - this is an unavoidable browser policy, not a bug. The visual walk +
  // gradual zoom always plays regardless. Sound works normally from here on
  // (the enter-button click unlocks it, and so does any resetIntro() replay).
  const APPROACH_SCALE = 1.32; // final push-in amount, reached on the 4th footstep
  const APPROACH_STEPS = 4;
  function playApproachIntro(){
    ensureAudio(); // best-effort; harmless if it stays silent until a real gesture happens
    hint.textContent = 'ได้ยินเสียงฝีเท้าเดินเข้ามา...';
    doorBob.classList.add('walking');
    doFootstepSequence(4, 750, ()=>{
      doorBob.classList.remove('walking');
      // hand off from the incremental inline scale to the .approach class,
      // which holds the exact same final value - no visual jump at the seam
      doorImgWrap.classList.add('approach');
      doorImgWrap.style.transform = '';
      setTimeout(()=>{
        fadeOutHint();
        startLayer.classList.add('show');
      }, 900);
    }, (stepIndex)=>{
      // nudge the zoom in a little more with each footstep so the push-in
      // toward the door happens as a continuous, smooth creep rather than
      // a single jump at the end
      const scale = 1 + (APPROACH_SCALE - 1) * (stepIndex / APPROACH_STEPS);
      doorImgWrap.style.transform = 'scale(' + scale.toFixed(3) + ')';
    });
  }
  playApproachIntro(); // auto-runs immediately on page load - no click needed

  // click handler for the enter button that only appears once playApproachIntro finishes
  function startSequence(){
    ensureAudio();
    startLayer.classList.remove('show');
    setTimeout(()=>{
      // hold the zoom at the .approach level (1.32x) and push in FURTHER
      // from there to the knob close-up (2.3x) - removing .approach and
      // adding .zoomed in the same tick (no gap between them) means there's
      // no frame where the transform reverts to its un-zoomed base, so the
      // zoom never dips back out before continuing in.
      doorImgWrap.classList.remove('approach');
      doorImgWrap.classList.add('zoomed');
      setTimeout(()=>{
        reachHand.classList.add('show');
        playDoorUnlockSound(); // key-turn clicks + latch thunk, held for a moment
        setTimeout(()=>{
          reachHand.classList.add('turning'); // small twisting gesture, as if turning the knob
        }, 250);
        setTimeout(()=>{
          lightBurst.classList.add('burst');
          setTimeout(()=>{
            resetQuestionText();
            nextBtn.classList.remove('show');
            questionLayer.classList.add('show');
            typeQuestion(QUESTION, 55, ()=>{
              nextBtn.classList.add('show');
            });
          }, 900);
        }, 1600);
      }, 1750); // matches the 1.7s zoomed-in transition
    }, 400);
  }
  enterBtn.addEventListener('click', startSequence);

  nextBtn.addEventListener('click', ()=>{
    questionLayer.classList.remove('show');
    setTimeout(()=>{
      answerLayer.classList.add('show');
      answerInput.focus();
    }, 500);
  });

  function resetIntro(){
    intro.classList.remove('hide');
    lightBurst.classList.remove('burst');
    doorBob.classList.remove('walking');
    doorImgWrap.classList.remove('approach', 'zoomed');
    doorImgWrap.style.transform = ''; // clear any leftover incremental zoom value from the last walk
    reachHand.classList.remove('show', 'turning');
    questionLayer.classList.remove('show');
    answerLayer.classList.remove('show');
    nextBtn.classList.remove('show');
    resetQuestionText();
    answerInput.value = '';
    answerInput.disabled = false;
    submitAnswerBtn.disabled = false;
    answerNote.textContent = '';
    startLayer.classList.remove('show');
    hint.textContent = '';

    deskScene.classList.remove('show');
    deskImgWrap.classList.remove('zoomed');
    deskGreetLayer1.classList.remove('show');
    deskNext1.classList.remove('show');
    deskNameLayer.classList.remove('show');
    deskGreetLayer2.classList.remove('show');
    deskNext3.classList.remove('show');
    deskPlateNext.classList.remove('show');
    deskParticleLayer.classList.remove('show');
    deskNext4.classList.remove('show');
    deskFinalLayer.classList.remove('show');
    deskNext5.classList.remove('show');
    name1Input.value = '';
    name1Note.textContent = '';
    deskGreeting.textContent = '';
    deskPlateName.innerHTML = '';
    resetTextEl(deskFinalText);
    deskParticleText.textContent = 'ครับ/ค่ะ';

    deskYearsQLayer.classList.remove('show');
    deskYearsQNext.classList.remove('show');
    resetTextEl(deskYearsQText);
    deskYearsAnswerLayer.classList.remove('show');
    answer2Input.value = '';
    answer2Note.textContent = '';
    deskYearsResultLayer.classList.remove('show');
    deskYearsResultNext.classList.remove('show');
    resetTextEl(deskYearsResultText);
    deskReflectLayer.classList.remove('show');
    resetTextEl(deskReflectText);
    deskWishLayer.classList.remove('show');
    deskWishNext.classList.remove('show');
    resetTextEl(deskWishText);
    deskChecklistLayer.classList.remove('show');
    checklistCheckboxes.forEach(cb=>{ cb.checked = false; cb.disabled = false; });
    checklistSubmit.disabled = false;
    checklistNote.textContent = '';

    page7.classList.remove('show');
    eyelidTop7.classList.remove('close');
    eyelidBottom7.classList.remove('close');
    page7TextLayer.classList.remove('show');
    resetTextEl(page7Text);
    page7RevealNext.classList.remove('show');
    name2Layer.classList.remove('show');
    name2Input.value = '';
    name2Input.disabled = false;
    name2Submit.disabled = false;
    name2Note.textContent = '';

    page8.classList.remove('show');
    dreamImgWrap.classList.remove('zoomed');
    dreamPlateText.textContent = '';
    eyelidTop8.classList.add('close'); // reset to page 8's default already-closed state
    eyelidBottom8.classList.add('close');
    dreamQLayer.classList.remove('show');
    resetTextEl(dreamQText);
    ringIcon.classList.remove('show');
    choose1Layer.classList.remove('show');
    page8Next.classList.remove('show');

    page9.classList.remove('show');
    cardPopupLayer.classList.remove('show');
    cardPopupImg.src = '';
    page9Next.classList.remove('show');

    answer1Value = '';
    name1Value = '';
    answer2Value = '';
    act1Value = ''; act2Value = ''; act3Value = '';
    name2Value = '';
    choose1Value = '';
    sessionId = generateSessionId();

    // replaying from scratch means replaying the whole auto walk-up +
    // approach-zoom cinematic too, not just re-showing the enter button
    playApproachIntro();
  }
  // the old #site mock page is gone, so the replay-reset shortcut now lives on <body>
  document.body.addEventListener('dblclick', resetIntro);

  /* ================= nameplate form -> Google Sheet ================= */
  // 1) เปิดชีตของคุณ -> Extensions > Apps Script -> วางโค้ด Code.gs ที่แนบมาให้
  // 2) Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone
  // 3) คัดลอก Web app URL ที่ได้ มาแทนที่ค่าด้านล่างนี้
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8dqj-u__-OFrpUsM7_0OScs3PmWZO1nVvXtm4iPdtO9AOCY25MtDPKwNE-ZYs0Olv8A/exec";

  const deskScene        = document.getElementById('deskScene');
  const deskImgWrap      = document.querySelector('.desk-imgwrap');
  const deskGreetLayer1  = document.getElementById('deskGreetLayer1');
  const deskNext1        = document.getElementById('deskNext1');
  const deskNameLayer    = document.getElementById('deskNameLayer');
  const deskNext2        = document.getElementById('deskNext2');
  const deskGreetLayer2  = document.getElementById('deskGreetLayer2');
  const deskGreeting     = document.getElementById('deskGreeting');
  const deskNext3        = document.getElementById('deskNext3');
  const deskPlateName    = document.getElementById('deskPlateName');
  const deskPlateNext    = document.getElementById('deskPlateNext');
  const deskParticleLayer = document.getElementById('deskParticleLayer');
  const deskParticleText = document.getElementById('deskParticleText');
  const deskNext4        = document.getElementById('deskNext4');
  const deskFinalLayer   = document.getElementById('deskFinalLayer');
  const deskFinalText    = document.getElementById('deskFinalText');
  const deskNext5        = document.getElementById('deskNext5');
  const name1Input       = document.getElementById('name1Input');
  const name1Note        = document.getElementById('name1Note');

  // remembered across steps so later messages can reuse what the visitor typed
  let answer1Value = '';
  let name1Value    = '';

  // Every postToSheet() call used to append a brand-new row, so one visitor's
  // Answer1/Name1/Answer2/Act1-3/Name2 ended up scattered across separate
  // rows. To keep everything on ONE row per visit, every call now tags its
  // data with the same sessionId; Code.gs finds the row with that id (if one
  // already exists) and fills in just those columns instead of appending a
  // new row each time. A fresh id is generated per visit/replay (see
  // resetIntro) so replays don't overwrite a real visitor's row.
  function generateSessionId(){
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  let sessionId = generateSessionId();

  function postToSheet(paramsObj){
    if(!SCRIPT_URL || SCRIPT_URL.indexOf('PASTE_') === 0){
      console.warn('ยังไม่ได้ตั้งค่า SCRIPT_URL — ข้ามการบันทึกลง Google ชีต');
      return Promise.resolve();
    }
    const merged = Object.assign({ SessionId: sessionId }, paramsObj);
    const body = Object.keys(merged)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(merged[k]))
      .join('&');
    // fire-and-forget: don't make the user wait on Apps Script's round trip.
    // mode:'no-cors' means we can't read the response anyway, so there's
    // nothing gained by awaiting it before updating the UI.
    fetch(SCRIPT_URL, {
      method:'POST',
      mode:'no-cors',
      keepalive:true,
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body
    }).catch(()=>{ /* silently ignore - request still goes out via keepalive */ });
    return Promise.resolve();
  }

  submitAnswerBtn.addEventListener('click', ()=>{
    const answer = answerInput.value.trim();
    if(!answer){
      answerInput.focus();
      answerNote.style.color = '#c0392b';
      answerNote.textContent = 'กรุณาพิมพ์คำตอบก่อนนะคะ';
      return;
    }
    answer1Value = answer;
    postToSheet({ 'Answer 1': answer });

    answerNote.style.color = '#3aa66b';
    answerNote.textContent = 'ส่งคำตอบเรียบร้อยแล้ว ✓';
    submitAnswerBtn.disabled = true;
    answerInput.disabled = true;
    answerLayer.classList.remove('show');

    // the door was already unlocked/opened earlier (right after the enter
    // button was clicked), so answering just reveals the desk scene directly
    // - a quick white flash sells the "step through the door and warp into
    // the room" feeling at the cut, instead of a plain crossfade.
    setTimeout(()=>{
      warpFlash.classList.add('flash');
      intro.classList.add('hide');
      showDeskScene();
      setTimeout(()=>{ warpFlash.classList.remove('flash'); }, 800);
    }, 600);
  });

  /* ================= desk scene: น้อง...... -> ชื่อ -> น้อง[Name1] มีคาบว่างเหรอจ๊ะ ================= */
  function showDeskScene(){
    deskScene.classList.add('show');
    deskGreetLayer1.classList.add('show');
    deskNext1.classList.add('show');
  }

  deskNext1.addEventListener('click', ()=>{
    deskGreetLayer1.classList.remove('show');
    setTimeout(()=>{
      deskNameLayer.classList.add('show');
      name1Input.focus();
    }, 500);
  });

  // after "น้องชื่ออะไรจ๊ะ" is answered: go straight to the nameplate
  // zoom-in/typing beat first (used to be the OTHER way around - greeting
  // line first, then the nameplate). The shot then FREEZES there - it no
  // longer auto-continues. It waits for the visitor to click deskPlateNext
  // before zooming back out, at which point "น้อง[Name1] มีคาบว่างเหรอจ๊ะ" is
  // shown, and only after THAT is answered does "[Name1] : ครับ/ค่ะ" appear.
  function goToGreeting2(){
    const name1 = name1Input.value.trim();
    if(!name1){
      name1Input.focus();
      name1Note.style.color = '#c0392b';
      name1Note.textContent = 'กรุณากรอกชื่อก่อนนะคะ';
      return;
    }
    name1Value = name1;
    postToSheet({ Name1: name1 });
    // built now, shown later (once we've zoomed back out from the nameplate)
    deskGreeting.innerHTML = `น้อง<span class="var-highlight">${escapeHtml(name1)}</span> มีคาบว่างเหรอจ๊ะ`;
    deskNameLayer.classList.remove('show');
    setTimeout(()=>{
      deskImgWrap.classList.add('zoomed');
      setTimeout(()=>{
        typeTextInto(deskPlateName, name1Value, 90, ()=>{
          deskPlateNext.classList.add('show');
        });
      }, 1750); // matches the 1.7s zoom-in transition
    }, 500);
  }
  deskNext2.addEventListener('click', goToGreeting2);
  name1Input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') goToGreeting2(); });

  // the visitor chooses when to move on from the frozen, zoomed-in nameplate
  // shot - zooming back out now reveals "น้อง[Name1] มีคาบว่างเหรอจ๊ะ". The
  // name written on the plate is NOT cleared here anymore - it stays visible
  // on the desk for the rest of the scene (it scales naturally with the
  // .desk-imgwrap zoom either way since it's a percentage-positioned child
  // of that same wrapper).
  deskPlateNext.addEventListener('click', ()=>{
    deskPlateNext.classList.remove('show');
    deskImgWrap.classList.remove('zoomed');
    setTimeout(()=>{
      deskGreetLayer2.classList.add('show');
      deskNext3.classList.add('show');
    }, 1750); // matches the 1.7s zoom-out transition
  });

  // step 4: "น้อง[Name1] มีคาบว่างเหรอจ๊ะ" -> "[Name1] : ครับ/ค่ะ"
  deskNext3.addEventListener('click', ()=>{
    deskGreetLayer2.classList.remove('show');
    setTimeout(()=>{
      // show the reply attributed to the visitor's own name (Name1)
      deskParticleText.innerHTML = `<span class="var-highlight">${escapeHtml(name1Value)}</span> : ครับ/ค่ะ`;
      deskParticleLayer.classList.add('show');
      deskNext4.classList.add('show');
    }, 500);
  });

  // step 5: "ครับ/ค่ะ" -> the 3-line reflection built from Answer 1
  // (still uses the same typewriter effect + typing sound as everywhere else;
  // Answer 1's value is highlighted in gold so it stands out from the rest)
  deskNext4.addEventListener('click', ()=>{
    deskParticleLayer.classList.remove('show');
    setTimeout(()=>{
      deskFinalLayer.classList.add('show');
      typeSegments(deskFinalText, [
        {text:'งาน '},
        {text:answer1Value, className:'var-highlight'},
        {text:' หนักและเหนื่อยมากเลยใช่ไหมล่ะ'},
        {br:true},
        {text:'ไม่ค่อยมีเวลาได้พักเลยล่ะซิ'},
        {br:true},
        {text:'ตอนนี้ได้พักแล้ว อยากจะทำอะไรล่ะ?'}
      ], 45, ()=>{
        deskNext5.classList.add('show');
      });
    }, 500);
  });

  /* ================= years-on-the-job -> reflection -> wish -> checklist ================= */
  const deskYearsQLayer     = document.getElementById('deskYearsQLayer');
  const deskYearsQText      = document.getElementById('deskYearsQText');
  const deskYearsQNext      = document.getElementById('deskYearsQNext');
  const deskYearsAnswerLayer = document.getElementById('deskYearsAnswerLayer');
  const answer2Input        = document.getElementById('answer2Input');
  const deskYearsSubmit     = document.getElementById('deskYearsSubmit');
  const answer2Note         = document.getElementById('answer2Note');
  const deskYearsResultLayer = document.getElementById('deskYearsResultLayer');
  const deskYearsResultText = document.getElementById('deskYearsResultText');
  const deskYearsResultNext = document.getElementById('deskYearsResultNext');
  const deskReflectLayer    = document.getElementById('deskReflectLayer');
  const deskReflectText     = document.getElementById('deskReflectText');
  const deskWishLayer       = document.getElementById('deskWishLayer');
  const deskWishText        = document.getElementById('deskWishText');
  const deskWishNext        = document.getElementById('deskWishNext');
  const deskChecklistLayer  = document.getElementById('deskChecklistLayer');
  const checklistGrid       = document.getElementById('checklistGrid');
  const checklistCheckboxes = checklistGrid.querySelectorAll('input[type="checkbox"]');
  const checklistSubmit     = document.getElementById('checklistSubmit');
  const checklistNote       = document.getElementById('checklistNote');

  let answer2Value = '';
  // the 3 chosen activities - remembered so page 8's phone call can quote them back
  let act1Value = '', act2Value = '', act3Value = '';

  // step 5: "เฮ้อ....ก็นั่งโต๊ะนี้มา" (this is where deskNext5 now leads instead
  // of just ending the scene - the story continues into the years/checklist chapter)
  deskNext5.addEventListener('click', ()=>{
    deskFinalLayer.classList.remove('show');
    setTimeout(()=>{
      deskYearsQLayer.classList.add('show');
      typeTextInto(deskYearsQText, 'เฮ้อ....ก็นั่งโต๊ะนี้มา', 55, ()=>{
        deskYearsQNext.classList.add('show');
      });
    }, 500);
  });

  deskYearsQNext.addEventListener('click', ()=>{
    deskYearsQLayer.classList.remove('show');
    setTimeout(()=>{
      deskYearsAnswerLayer.classList.add('show');
      answer2Input.focus();
    }, 500);
  });

  deskYearsSubmit.addEventListener('click', ()=>{
    const years = answer2Input.value.trim();
    if(!years){
      answer2Input.focus();
      answer2Note.style.color = '#c0392b';
      answer2Note.textContent = 'กรุณากรอกจำนวนปีก่อนนะคะ';
      return;
    }
    answer2Value = years;
    postToSheet({ 'Answer 2': years });
    deskYearsAnswerLayer.classList.remove('show');
    setTimeout(()=>{
      deskYearsResultLayer.classList.add('show');
      // Answer 2's value highlighted the same way as every other variable
      typeSegments(deskYearsResultText, [
        {text:'เฮ้อ....ก็นั่งโต๊ะนี้มา'},
        {text:answer2Value, className:'var-highlight'},
        {text:'ปีแล้ว'}
      ], 55, ()=>{
        deskYearsResultNext.classList.add('show');
      });
    }, 500);
  });
  answer2Input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') deskYearsSubmit.click(); });

  deskYearsResultNext.addEventListener('click', ()=>{
    deskYearsResultLayer.classList.remove('show');
    setTimeout(()=>{
      deskReflectLayer.classList.add('show');
      typeTextInto(deskReflectText, 'นานแค่ไหนแล้วนะ..... /ที่ไม่ได้นั่งเปื่อย โดยไม่มีงานแทรก', 50, ()=>{
        // no next button for this beat - give the reader a moment, then it
        // fades away on its own and the story moves on automatically
        setTimeout(()=>{
          deskReflectLayer.classList.remove('show');
          setTimeout(()=>{
            deskWishLayer.classList.add('show');
            typeSegments(deskWishText, [
              {text:'ถ้าเสกให้งาน'},
              {text:answer1Value, className:'var-highlight'},
              {text:'หายไปได้'},
              {br:true},
              {text:'สิ่งที่จะทำก็คือ'}
            ], 50, ()=>{
              deskWishNext.classList.add('show');
            });
          }, 500); // matches the .question-layer fade-out transition
        }, 2000); // reading time before it disappears
      });
    }, 500);
  });

  deskWishNext.addEventListener('click', ()=>{
    deskWishLayer.classList.remove('show');
    setTimeout(()=>{
      deskChecklistLayer.classList.add('show');
    }, 500);
  });

  // paper checklist: exactly 3 choices allowed, stored as act1 / act2 / act3
  checklistCheckboxes.forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const checkedCount = checklistGrid.querySelectorAll('input:checked').length;
      if(checkedCount > 3){
        cb.checked = false;
        checklistNote.style.color = '#c0392b';
        checklistNote.textContent = 'เลือกได้สูงสุด 3 รายการนะคะ';
      } else {
        checklistNote.textContent = '';
      }
    });
  });

  checklistSubmit.addEventListener('click', ()=>{
    const chosen = Array.from(checklistGrid.querySelectorAll('input:checked')).map(cb => cb.value);
    if(chosen.length !== 3){
      checklistNote.style.color = '#c0392b';
      checklistNote.textContent = 'กรุณาเลือกให้ครบ 3 รายการนะคะ';
      return;
    }
    const [act1, act2, act3] = chosen;
    act1Value = act1; act2Value = act2; act3Value = act3;
    postToSheet({ Act1: act1, Act2: act2, Act3: act3 });
    checklistNote.style.color = '#3aa66b';
    checklistNote.textContent = 'ส่งคำตอบเรียบร้อยแล้ว ✓';
    checklistSubmit.disabled = true;
    checklistCheckboxes.forEach(cb => cb.disabled = true);

    setTimeout(()=>{
      deskChecklistLayer.classList.remove('show');
      deskScene.classList.remove('show');
      showPage7();
    }, 900);
  });

  /* ================= page 7: black screen -> dozes off -> dream -> Name2 ================= */
  const page7          = document.getElementById('page7');
  const eyelidTop7     = document.getElementById('eyelidTop7');
  const eyelidBottom7  = document.getElementById('eyelidBottom7');
  const page7TextLayer = document.getElementById('page7TextLayer');
  const page7Text      = document.getElementById('page7Text');
  const name2Layer     = document.getElementById('name2Layer');
  const name2Input     = document.getElementById('name2Input');
  const name2Submit    = document.getElementById('name2Submit');
  const name2Note      = document.getElementById('name2Note');
  const page7RevealNext = document.getElementById('page7RevealNext');
  let name2Value = '';

  // types `text` into page7Text while page7TextLayer fades in, waits `readMs`
  // once typing is done so the visitor can read it, then fades the layer
  // back out and calls onDone once that fade finishes - fully automatic,
  // no button click needed (used for the two lines that disappear on their own).
  function typeAutoAdvance(text, readMs, onDone){
    page7TextLayer.classList.add('show');
    typeTextInto(page7Text, text, 55, ()=>{
      setTimeout(()=>{
        page7TextLayer.classList.remove('show');
        setTimeout(onDone, 600); // matches .page7-text-layer's fade-out transition
      }, readMs);
    });
  }

  function showPage7(){
    page7.classList.add('show');
    setTimeout(()=>{
      typeAutoAdvance('คุณนั่งอยู่บนเก้าอี้ห้องพักครูสักพัก', 1800, ()=>{
        typeAutoAdvance('แล้วเผลอหลับไป เพราะความเหนื่อยล้า', 1800, ()=>{
          // eyes closing: two dark eyelids slide in from the top and bottom
          // and meet in the middle - the scene stays fully black from here
          // through the rest of the dream reveal below, through the cut into
          // page 8 (which starts already-closed), all the way until the
          // phone starts ringing there.
          eyelidTop7.classList.add('close');
          eyelidBottom7.classList.add('close');
          setTimeout(()=>{
            page7TextLayer.classList.add('show');
            typeTextInto(page7Text, 'คุณฝันเห็นคนสำคัญที่สุดในชีวิต /ซึ่งคนนั้น คือ', 55, ()=>{
              setTimeout(()=>{
                name2Layer.classList.add('show');
                name2Input.focus();
              }, 600);
            });
          }, 1300); // matches the 1.3s eyelid-close transition
        });
      });
    }, 1200); // pause on the still image before the first line appears
  }

  name2Submit.addEventListener('click', ()=>{
    const name2 = name2Input.value.trim();
    if(!name2){
      name2Input.focus();
      name2Note.style.color = '#c0392b';
      name2Note.textContent = 'กรุณากรอกชื่อก่อนนะคะ';
      return;
    }
    name2Value = name2;
    postToSheet({ Name2: name2 });
    name2Note.style.color = '#3aa66b';
    name2Note.textContent = 'ส่งคำตอบเรียบร้อยแล้ว ✓';
    name2Submit.disabled = true;
    name2Input.disabled = true;

    // "คุณฝันเห็นคนสำคัญที่สุดในชีวิตคือ [Name2]" - Name2 highlighted, then a Next button
    setTimeout(()=>{
      name2Layer.classList.remove('show');
      setTimeout(()=>{
        typeSegments(page7Text, [
          {text:'คุณฝันเห็นคนสำคัญที่สุดในชีวิตคือ '},
          {text:name2Value, className:'var-highlight'}
        ], 55, ()=>{
          page7RevealNext.classList.add('show');
        });
      }, 500);
    }, 900);
  });
  name2Input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') name2Submit.click(); });

  page7RevealNext.addEventListener('click', ()=>{
    page7RevealNext.classList.remove('show');
    page7.classList.remove('show');
    setTimeout(showPage8, 1000); // matches #page7's fade-out transition
  });

  /* ================= page 8: dream continues - nameplate, ringing phone, phone call ================= */
  const page8          = document.getElementById('page8');
  const dreamImgWrap    = document.querySelector('.dream-imgwrap');
  const eyelidTop8      = document.getElementById('eyelidTop8');
  const eyelidBottom8   = document.getElementById('eyelidBottom8');
  const dreamPlateText = document.getElementById('dreamPlateText');
  const dreamQLayer    = document.getElementById('dreamQLayer');
  const dreamQText     = document.getElementById('dreamQText');
  const ringIcon       = document.getElementById('ringIcon');
  const choose1Layer   = document.getElementById('choose1Layer');
  const choose1Postpone = document.getElementById('choose1Postpone');
  const choose1Keep    = document.getElementById('choose1Keep');
  const page8Next      = document.getElementById('page8Next');
  let choose1Value = '';

  // Every dialogue line from here on (Name1's hello, Name2's memory line, the
  // choose1 popup, the branch outcome, and the goodbye line) is shown through
  // dreamQLayer/dreamQText - the same centered, dark-scrim, transparent-black
  // box style used everywhere else in the site. Critically, dreamQLayer sits
  // OUTSIDE .dream-imgwrap in the HTML, so it is NEVER affected by
  // .dream-imgwrap's zoom scale. We also always zoom back out before any of
  // this text appears, so there's no risk of it being pushed off-screen.
  function typeDreamAutoAdvance(text, readMs, onDone){
    dreamQLayer.classList.add('show');
    typeTextInto(dreamQText, text, 55, ()=>{
      setTimeout(()=>{
        dreamQLayer.classList.remove('show');
        setTimeout(onDone, 500); // matches .question-layer's fade-out transition
      }, readMs);
    });
  }
  // segments version (for lines that need a highlighted variable, e.g. Name1/Name2/act1-3)
  function typeDreamSegments(segments, readMs, onDone){
    dreamQLayer.classList.add('show');
    typeSegments(dreamQText, segments, 45, ()=>{
      setTimeout(()=>{
        dreamQLayer.classList.remove('show');
        setTimeout(onDone, 500); // matches .question-layer's fade-out transition
      }, readMs);
    });
  }

  function showPage8(){
    ensureAudio();
    dreamPlateText.textContent = name1Value; // already written on the nameplate - it's a memory
    page8.classList.add('show'); // starts already-closed (eyelidTop8/eyelidBottom8 default to .close) - the black carries straight over from the end of page 7

    setTimeout(()=>{
      typeDreamAutoAdvance('เสียงโทรศัพท์ดังขึ้นจนปลุกคุณให้ตื่นขึ้น', 1000, ()=>{
        // eyes open again, revealing the desk + phone right as it starts ringing
        eyelidTop8.classList.remove('close');
        eyelidBottom8.classList.remove('close');
        // phone starts ringing: sound + pulsing icon, then zoom in on it
        ringIcon.classList.add('show');
        doRingSequence(3, 1500, ()=>{ /* ring sound finished; icon stays until "answered" */ });
        setTimeout(()=>{
          dreamImgWrap.classList.add('zoomed');
          setTimeout(()=>{
            ringIcon.classList.remove('show'); // picked up - ringing stops
            // zoom straight back out again - all the dialogue below happens
            // de-zoomed, so it can never overflow the screen
            setTimeout(()=>{
              dreamImgWrap.classList.remove('zoomed');
              setTimeout(()=>{
                typeDreamSegments([
                {text:name1Value, className:'var-highlight'},
                {text:': ฮัลโหล ว่ายังไง?'}
              ], 1600, ()=>{
                typeDreamSegments([
                  {text:name2Value, className:'var-highlight'},
                  {text:':ที่เราเคยคุยกันว่าจะ '},
                  {text:act1Value, className:'var-highlight'},
                  {text:' '},
                  {text:act2Value, className:'var-highlight'},
                  {text:' และ '},
                  {text:act3Value, className:'var-highlight'},
                  {text:' อ่ะ  '},
                  {br:true},
                  {text:'เลื่อนก็ได้นะ  เห็นว่าช่วงนี้งานยุ่งมากนี่....'}
                ], 1900, ()=>{
                  choose1Layer.classList.add('show');
                });
              });
            }, 1750); // matches the 1.7s zoom-out transition
          }, 350);
        }, 1750); // matches the 1.7s zoom-in transition
      }, 500);
      });
    }, 1200); // pause on the black screen before the ring line appears
  }

  function chooseOutcome(value){
    choose1Value = value;
    postToSheet({ Choose1: value });
    choose1Layer.classList.remove('show');
    setTimeout(()=>{
      const segments = value === 'เลื่อนนัด' ? [
        {text:name2Value, className:'var-highlight'},
        {text:' : เข้าใจว่า '},
        {text:answer1Value, className:'var-highlight'},
        {text:' มันสำคัญมาก และมันคงยังไม่เสร็จในเร็วๆนี้'},
        {br:true},
        {text:'ไว้เราค่อยนัดกัน '},
        {br:true},
        {text:act1Value, className:'var-highlight'},
        {text:' '},
        {text:act2Value, className:'var-highlight'},
        {text:' และ'},
        {text:act3Value, className:'var-highlight'},
        {text:' กันใหม่ก็ได้'}
      ] : [
        {text:name2Value, className:'var-highlight'},
        {text:' : ดีจังเลย!   ที่เราได้ '},
        {text:act1Value, className:'var-highlight'},
        {br:true},
        {text:act2Value, className:'var-highlight'},
        {text:' และ'},
        {text:act3Value, className:'var-highlight'},
        {text:' กันสักที'}
      ];
      dreamQLayer.classList.add('show');
      typeSegments(dreamQText, segments, 45, ()=>{
        page8Next.classList.add('show');
      });
    }, 400);
  }
  choose1Postpone.addEventListener('click', ()=> chooseOutcome('เลื่อนนัด'));
  choose1Keep.addEventListener('click', ()=> chooseOutcome('ไม่เลื่อนนัด'));

  // page 8's last beat: Name1 says goodbye (already de-zoomed at this point),
  // then crossfade into page 9's wide room shot.
  page8Next.addEventListener('click', ()=>{
    page8Next.classList.remove('show');
    dreamQLayer.classList.remove('show');
    setTimeout(()=>{
      typeDreamSegments([
        {text:name1Value, className:'var-highlight'},
        {text:':ไว้ค่อยคุยกันนะ'},
        {br:true},
        {text:'หมดเวลาพักแล้ว ต้องไปสอนต่อแล้วนะ'}
      ], 1900, ()=>{
        page8.classList.remove('show');
        showPage9();
      });
    }, 500);
  });

  /* ================= page 9: wide room reveal, then maybe an admin-configured card ================= */
  const page9          = document.getElementById('page9');
  const cardPopupLayer = document.getElementById('cardPopupLayer');
  const cardPopupImg   = document.getElementById('cardPopupImg');
  const cardPopupClose   = document.getElementById('cardPopupClose');
  const cardPopupRestart = document.getElementById('cardPopupRestart');
  const page9Next      = document.getElementById('page9Next');

  function showPage9(){
    page9.classList.add('show');
    setTimeout(fetchAndShowCard, 350);
  }

  // Cards are configured by the admin (see the admin panel): admin can add an
  // unlimited number of rules, each requiring an EXACT match against all 3 of
  // the visitor's chosen activities (act1/act2/act3) - order doesn't matter,
  // but all 3 of the rule's activities must be exactly the visitor's 3. The
  // first matching rule wins. If nothing matches (or the request fails, e.g.
  // offline), we just skip straight to the "next" button so the story never gets stuck.
  function fetchAndShowCard(){
    if(!SCRIPT_URL || SCRIPT_URL.indexOf('PASTE_') === 0){ page9Next.classList.add('show'); return; }
    fetch(SCRIPT_URL + '?action=getCards')
      .then(r => r.json())
      .then(cards => {
        const mine = [act1Value, act2Value, act3Value].map(activityCode).slice().sort();
        const match = (cards || []).find(c => {
          const theirs = (c.activities || []).slice().sort();
          return theirs.length === 3 && theirs[0] === mine[0] && theirs[1] === mine[1] && theirs[2] === mine[2];
        });
        if(match && match.imageUrl){
          cardPopupImg.src = match.imageUrl;
          cardPopupLayer.classList.add('show');
        } else {
          page9Next.classList.add('show');
        }
      })
      .catch(()=>{ page9Next.classList.add('show'); });
  }

  // the final card gives two distinct choices: just close the card and stay
  // on the quiet room shot, or fully restart - which does a real browser
  // refresh so every bit of state (sessionId, typed answers, audio, etc.)
  // comes back completely clean, not just a JS-level reset.
  cardPopupClose.addEventListener('click', ()=>{
    cardPopupLayer.classList.remove('show');
  });
  cardPopupRestart.addEventListener('click', ()=>{
    window.location.reload();
  });
  // no-card fallback (page 10 isn't specified yet) restarts the same way
  page9Next.addEventListener('click', ()=>{
    window.location.reload();
  });

  /* ================= ADMIN ================= */
  // NOTE: this is a simple client-side gate only (username/password are
  // literally compared in this JS file, which anyone can view via "view
  // source"). It matches what was asked for, but it is NOT real security -
  // don't rely on this to protect sensitive data.
  const adminLinkTrigger  = document.getElementById('adminLinkTrigger');
  const adminLoginOverlay = document.getElementById('adminLoginOverlay');
  const adminUser         = document.getElementById('adminUser');
  const adminPass         = document.getElementById('adminPass');
  const adminLoginBtn     = document.getElementById('adminLoginBtn');
  const adminLoginNote    = document.getElementById('adminLoginNote');
  const adminDashOverlay  = document.getElementById('adminDashOverlay');
  const adminLogoutBtn    = document.getElementById('adminLogoutBtn');
  const adminRulesList    = document.getElementById('adminRulesList');
  const adminAddRuleGrid  = document.getElementById('adminAddRuleGrid');
  const adminAddRuleUrl   = document.getElementById('adminAddRuleUrl');
  const adminAddRuleBtn   = document.getElementById('adminAddRuleBtn');
  const adminAddRuleNote  = document.getElementById('adminAddRuleNote');
  const adminLoadDataBtn  = document.getElementById('adminLoadDataBtn');
  const adminExportPdfBtn = document.getElementById('adminExportPdfBtn');
  const adminTableWrap    = document.getElementById('adminTableWrap');
  const adminLoadChartsBtn      = document.getElementById('adminLoadChartsBtn');
  const adminExportChartsPdfBtn = document.getElementById('adminExportChartsPdfBtn');
  const adminChartsWrap         = document.getElementById('adminChartsWrap');
  let adminChartsData = null; // { workload:[{label,count}], hobbies:[{label,count}] } - cached so PDF export doesn't need a re-fetch

  let adminCreds = null; // { user, pass } once logged in, reused for every admin request
  let adminLastRows = null; // last data loaded, so PDF export doesn't need a re-fetch

  function openAdminLogin(e){
    if(e) e.preventDefault();
    adminUser.value = ''; adminPass.value = ''; adminLoginNote.textContent = '';
    adminLoginOverlay.classList.add('show');
  }
  // the only entry point now: the small gear icon, top-right, present on every page
  adminLinkTrigger.addEventListener('click', openAdminLogin);

  adminLoginBtn.addEventListener('click', ()=>{
    const user = adminUser.value.trim();
    const pass = adminPass.value;
    if(!user || !pass){
      adminLoginNote.style.color = '#c0392b';
      adminLoginNote.textContent = 'กรอกชื่อผู้ใช้และรหัสผ่านก่อนนะคะ';
      return;
    }
    adminLoginNote.style.color = '#3b2a1a';
    adminLoginNote.textContent = 'กำลังตรวจสอบ...';
    fetch(SCRIPT_URL + '?action=login&user=' + encodeURIComponent(user) + '&pass=' + encodeURIComponent(pass))
      .then(r => r.json())
      .then(res => {
        if(res && res.ok){
          adminCreds = { user, pass };
          adminLoginOverlay.classList.remove('show');
          openAdminDashboard();
        } else {
          adminLoginNote.style.color = '#c0392b';
          adminLoginNote.textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        }
      })
      .catch(()=>{
        adminLoginNote.style.color = '#c0392b';
        adminLoginNote.textContent = 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';
      });
  });
  adminPass.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') adminLoginBtn.click(); });

  adminLogoutBtn.addEventListener('click', ()=>{
    adminCreds = null;
    adminLastRows = null;
    adminDashOverlay.classList.remove('show');
  });

  function adminAuthQS(){
    return 'user=' + encodeURIComponent(adminCreds.user) + '&pass=' + encodeURIComponent(adminCreds.pass);
  }

  function openAdminDashboard(){
    adminDashOverlay.classList.add('show');
    buildAddRuleGrid();
    loadRulesList();
  }

  // builds the "add new rule" 15-activity checklist once (reused for every new rule added)
  function buildAddRuleGrid(){
    if(adminAddRuleGrid.children.length) return; // already built
    ACTIVITY_LIST.forEach((name, i)=>{
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = 'ch' + (i + 1);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(name));
      adminAddRuleGrid.appendChild(label);
    });
  }

  // 'ch3' -> 'ไปเที่ยว' etc., for showing existing rules in readable Thai
  function codeToName(code){
    const idx = parseInt(String(code).replace('ch',''), 10) - 1;
    return ACTIVITY_LIST[idx] || code;
  }

  function loadRulesList(){
    adminRulesList.textContent = 'กำลังโหลด...';
    fetch(SCRIPT_URL + '?action=getCards')
      .then(r => r.json())
      .then(cards => { renderRulesList(cards || []); })
      .catch(()=>{ adminRulesList.textContent = 'โหลดเงื่อนไขไม่สำเร็จ'; });
  }

  function renderRulesList(cards){
    if(!cards.length){
      adminRulesList.innerHTML = '<p style="font-size:.85rem;color:#8a7a63;">ยังไม่มีเงื่อนไขที่บันทึกไว้</p>';
      return;
    }
    adminRulesList.innerHTML = '';
    cards.forEach(card=>{
      const row = document.createElement('div');
      row.className = 'admin-rule-list-item';
      const names = (card.activities || []).map(codeToName).join(' + ');
      row.innerHTML =
        '<img src="' + escapeHtml(card.imageUrl) + '" class="admin-rule-thumb" alt="">' +
        '<span class="admin-rule-names">' + escapeHtml(names) + '</span>' +
        '<button class="admin-rule-delete">ลบ</button>';
      row.querySelector('.admin-rule-delete').addEventListener('click', ()=>{ deleteRule(card.ruleId, row); });
      adminRulesList.appendChild(row);
    });
  }

  function deleteRule(ruleId, row){
    row.style.opacity = '.5';
    fetch(SCRIPT_URL + '?action=deleteCard&ruleId=' + encodeURIComponent(ruleId) + '&' + adminAuthQS())
      .then(r => r.json())
      .then(res => {
        if(res && res.ok){ row.remove(); }
        else { row.style.opacity = '1'; alert('ลบไม่สำเร็จ'); }
      })
      .catch(()=>{ row.style.opacity = '1'; alert('เชื่อมต่อไม่ได้'); });
  }

  adminAddRuleBtn.addEventListener('click', ()=>{
    const checked = Array.from(adminAddRuleGrid.querySelectorAll('input:checked')).map(cb => cb.value);
    if(checked.length !== 3){
      adminAddRuleNote.style.color = '#c0392b';
      adminAddRuleNote.textContent = 'ต้องเลือกกิจกรรมให้ครบ 3 อย่างพอดี (ตอนนี้เลือกไว้ ' + checked.length + ' อย่าง)';
      return;
    }
    const imageUrl = adminAddRuleUrl.value.trim();
    if(!imageUrl){
      adminAddRuleNote.style.color = '#c0392b';
      adminAddRuleNote.textContent = 'ต้องใส่ลิงก์ภาพการ์ด';
      return;
    }
    adminAddRuleNote.style.color = '#3b2a1a';
    adminAddRuleNote.textContent = 'กำลังบันทึก...';
    fetch(SCRIPT_URL + '?action=addCard&activities=' + encodeURIComponent(checked.join(',')) +
          '&imageUrl=' + encodeURIComponent(imageUrl) + '&' + adminAuthQS())
      .then(r => r.json())
      .then(res => {
        if(res && res.ok){
          adminAddRuleNote.style.color = '#3aa66b';
          adminAddRuleNote.textContent = 'เพิ่มเงื่อนไขแล้ว ✓';
          adminAddRuleGrid.querySelectorAll('input:checked').forEach(cb => { cb.checked = false; });
          adminAddRuleUrl.value = '';
          loadRulesList();
        } else {
          adminAddRuleNote.style.color = '#c0392b';
          adminAddRuleNote.textContent = (res && res.error) || 'บันทึกไม่สำเร็จ';
        }
      })
      .catch(()=>{
        adminAddRuleNote.style.color = '#c0392b';
        adminAddRuleNote.textContent = 'เชื่อมต่อไม่ได้';
      });
  });

  adminLoadDataBtn.addEventListener('click', ()=>{
    adminTableWrap.textContent = 'กำลังโหลด...';
    fetch(SCRIPT_URL + '?action=getAllData&' + adminAuthQS())
      .then(r => r.json())
      .then(res => {
        if(!res || !res.ok){ adminTableWrap.textContent = 'โหลดข้อมูลไม่สำเร็จ'; return; }
        adminLastRows = res.rows || [];
        renderAdminTable(adminLastRows);
      })
      .catch(()=>{ adminTableWrap.textContent = 'เชื่อมต่อไม่ได้'; });
  });

  // display-only column list: SessionId and เวลา (the raw timestamp) are
  // deliberately left out, and every remaining field gets a friendlier Thai
  // label. Keyed off the ORIGINAL field names returned by getAllData_, so
  // buildChartData() (which reads those same original keys) doesn't need
  // to change at all.
  const ADMIN_TABLE_COLUMNS = [
    { key:'Answer 1', label:'ปัญหาภาระงาน' },
    { key:'Answer 2', label:'อายุราชการ (ปี)' },
    { key:'Name1',    label:'ชื่อผู้ตอบแบบสำรวจ' },
    { key:'Act1',     label:'งานอดิเรกที่ 1' },
    { key:'Act2',     label:'งานอดิเรกที่ 2' },
    { key:'Act3',     label:'งานอดิเรกที่ 3' },
    { key:'Name2',    label:'ชื่อคนสำคัญของผู้ตอบแบบสอบถาม' },
    { key:'Choose1',  label:'การตัดสินใจเรื่องนัดหมาย' }
  ];

  function renderAdminTable(rows){
    if(!rows.length){ adminTableWrap.textContent = 'ยังไม่มีข้อมูล'; return; }
    let html = '<table class="admin-table"><tr>' +
      ADMIN_TABLE_COLUMNS.map(c => '<th>' + escapeHtml(c.label) + '</th>').join('') + '</tr>';
    rows.forEach(row=>{
      html += '<tr>' + ADMIN_TABLE_COLUMNS.map(c =>
        '<td>' + (row[c.key] != null ? escapeHtml(String(row[c.key])) : '') + '</td>'
      ).join('') + '</tr>';
    });
    html += '</table>';
    adminTableWrap.innerHTML = html;
  }

  // Exports via the browser's own print dialog ("Save as PDF") instead of a
  // PDF-building library like jsPDF: jsPDF's built-in fonts don't support
  // Thai glyphs at all (same kind of issue this project already ran into
  // once with the typewriter effect), so a jsPDF export would come out
  // blank/garbled. Printing a plain HTML table lets the browser render the
  // Thai text normally, and "Save as PDF" is one of the standard print
  // destinations in every major browser.
  adminExportPdfBtn.addEventListener('click', ()=>{
    const rows = adminLastRows;
    if(!rows || !rows.length){ alert('กรุณากด "โหลดข้อมูล" ก่อนส่งออกเป็น PDF'); return; }
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ข้อมูลผู้ใช้ - ห้องพักครู</title>' +
      '<style>' +
      '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}' +
      'body{font-family:"Sarabun","Noto Sans Thai","Segoe UI",sans-serif;padding:24px;}' +
      'h1{font-size:18px;margin-bottom:14px;}' +
      'table{border-collapse:collapse;width:100%;font-size:11px;}' +
      'th,td{border:1px solid #999;padding:5px 8px;text-align:left;}' +
      'th{background:#e0a860;}' +
      'tr:nth-child(even){background:#fbf5e6;}' +
      '</style></head><body>' +
      '<h1>ข้อมูลผู้ใช้ - ห้องพักครู</h1><table><tr>' +
      ADMIN_TABLE_COLUMNS.map(c => '<th>' + c.label + '</th>').join('') + '</tr>';
    rows.forEach(row=>{
      html += '<tr>' + ADMIN_TABLE_COLUMNS.map(c =>
        '<td>' + (row[c.key] != null ? String(row[c.key]) : '') + '</td>'
      ).join('') + '</tr>';
    });
    html += '</table></body></html>';

    const w = window.open('', '_blank');
    if(!w){ alert('เบราว์เซอร์บล็อกป็อปอัป กรุณาอนุญาตป็อปอัปแล้วลองใหม่'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(()=>{ w.focus(); w.print(); }, 300);
  });

  /* ================= admin: survey result graphs ================= */
  // tallies Answer 1 (workload) as free-text buckets, and Act1/Act2/Act3
  // (hobbies) against the fixed 15-item ACTIVITY_LIST, from the same
  // getAllData_ rows used by the data table above.
  function buildChartData(rows){
    const workloadCounts = {};
    const hobbyCounts = {};
    ACTIVITY_LIST.forEach(name => { hobbyCounts[name] = 0; });
    rows.forEach(row=>{
      const a1 = (row['Answer 1'] || '').toString().trim();
      if(a1){ workloadCounts[a1] = (workloadCounts[a1] || 0) + 1; }
      ['Act1','Act2','Act3'].forEach(key=>{
        const v = (row[key] || '').toString().trim();
        if(v && Object.prototype.hasOwnProperty.call(hobbyCounts, v)){ hobbyCounts[v]++; }
      });
    });
    const toSortedArray = obj => Object.keys(obj)
      .map(k => ({ label:k, count:obj[k] }))
      .sort((a,b)=> b.count - a.count);
    return {
      workload: toSortedArray(workloadCounts),
      hobbies: toSortedArray(hobbyCounts)
    };
  }

  function barChartHtml(title, data){
    const max = Math.max(1, ...data.map(d => d.count));
    let html = '<div class="chart-title">' + escapeHtml(title) + '</div><div class="bar-chart">';
    if(!data.length){
      html += '<p style="font-size:.85rem;color:#8a7a63;">ยังไม่มีข้อมูล</p>';
    } else {
      data.forEach(d=>{
        const pct = Math.round((d.count / max) * 100);
        html += '<div class="bar-row">' +
          '<span class="bar-label">' + escapeHtml(d.label) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="bar-count">' + d.count + '</span>' +
        '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  adminLoadChartsBtn.addEventListener('click', ()=>{
    adminChartsWrap.textContent = 'กำลังโหลด...';
    fetch(SCRIPT_URL + '?action=getAllData&' + adminAuthQS())
      .then(r => r.json())
      .then(res => {
        if(!res || !res.ok){ adminChartsWrap.textContent = 'โหลดข้อมูลไม่สำเร็จ'; return; }
        adminChartsData = buildChartData(res.rows || []);
        adminChartsWrap.innerHTML =
          barChartHtml('กราฟตามภาระงานอื่นที่เหนื่อยที่สุด (Answer 1)', adminChartsData.workload) +
          barChartHtml('กราฟตามงานอดิเรกที่อยากทำ (Act1-3)', adminChartsData.hobbies);
      })
      .catch(()=>{ adminChartsWrap.textContent = 'เชื่อมต่อไม่ได้'; });
  });

  adminExportChartsPdfBtn.addEventListener('click', ()=>{
    if(!adminChartsData){ alert('กรุณากด "โหลดกราฟ" ก่อนพิมพ์เป็น PDF'); return; }
    const bodyHtml =
      barChartHtml('กราฟตามภาระงานอื่นที่เหนื่อยที่สุด (Answer 1)', adminChartsData.workload) +
      barChartHtml('กราฟตามงานอดิเรกที่อยากทำ (Act1-3)', adminChartsData.hobbies);
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>กราฟสรุปผล - ห้องพักครู</title>' +
      '<style>' +
      // browsers strip background colors when printing by default (to save
      // ink) unless explicitly told not to - without this, every bar would
      // print/PDF as blank white regardless of its background-color below
      '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}' +
      'body{font-family:"Sarabun","Noto Sans Thai","Segoe UI",sans-serif;padding:24px;color:#3b2a1a;}' +
      'h1{font-size:18px;margin-bottom:14px;}' +
      '.chart-title{font-size:14px;font-weight:600;margin:20px 0 10px;}' +
      '.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;}' +
      '.bar-label{width:200px;flex-shrink:0;font-size:12px;text-align:right;}' +
      '.bar-track{flex:1;background:#f2ede0;border-radius:4px;overflow:hidden;height:14px;}' +
      '.bar-fill{background:#c98a44;height:100%;}' +
      '.bar-count{width:26px;flex-shrink:0;font-size:12px;}' +
      '@media print{ .bar-track,.bar-fill{ -webkit-print-color-adjust:exact;print-color-adjust:exact; } }' +
      '</style></head><body>' +
      '<h1>กราฟสรุปผลสำรวจ - ห้องพักครู</h1>' + bodyHtml +
      '</body></html>';

    const w = window.open('', '_blank');
    if(!w){ alert('เบราว์เซอร์บล็อกป็อปอัป กรุณาอนุญาตป็อปอัปแล้วลองใหม่'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(()=>{ w.focus(); w.print(); }, 300);
  });
