document.getElementById('scenes').innerHTML = `
<div class="scene" data-scene="1">
  <div class="badge" data-in="a@1" data-a="pop" style="left:70px;top:350px;width:470px;height:72px">● En vigueur · 3 nov. 2026</div>
  <div class="big" data-in="a@3" data-a="up" style="left:70px;top:450px;width:820px;height:170px">Entrée express <span class="acc">change de visage.</span></div>
  <svg data-in="a@6" data-a="fade" data-draw style="left:70px;top:625px;width:430px;height:34px" viewBox="0 0 430 34">
    <path d="M6 24 Q110 6 215 20 T424 14" stroke="#cc1627" stroke-width="9" fill="none" stroke-linecap="round"/>
  </svg>
  <div class="card" data-in="b@2" data-a="drop" data-r="-2" style="left:70px;top:700px;width:560px;height:200px">
    <div class="t">Score CRS</div>
    <p>recalculé pour tous les profils</p>
  </div>
  <div class="hand rouge" data-in="b@7" data-a="fade" data-r="-3" style="left:100px;top:930px;width:540px;height:70px">≈ 2 semaines de pause</div>
</div>

<div class="scene" data-scene="2">
  <div class="stat rouge" data-in="c@3" data-a="pop" data-count="150" data-pre="+" data-kf='[["d",{"s":0.82,"y":-18}]]' style="left:70px;top:350px;width:420px;height:230px">
    <span class="n">0</span><small>points max · marché du travail</small>
  </div>
  <div class="stamp" data-in="d@1" data-a="stamp" data-r="-7" style="left:520px;top:400px;width:360px;height:96px">EIMT : 0 pt</div>
  <div class="card" data-in="c@5" data-a="up" style="left:70px;top:640px;width:600px;height:330px">
    <table class="mini-table">
      <tr><th>Salaire vs médiane</th><th>Offre</th></tr>
      <tr class="hot"><td>≥ 2×</td><td>+100</td></tr>
      <tr><td>≥ 1,5×</td><td>+70</td></tr>
      <tr><td>≥ 1,3×</td><td>+50</td></tr>
    </table>
  </div>
</div>

<div class="scene" data-scene="3">
  <div class="card" data-in="e" data-a="up" style="left:70px;top:350px;width:560px;height:300px">
    <ul class="checklist">
      <li data-cls="e@2:on">Test de français</li>
      <li data-cls="e@7:on">Emploi bien payé</li>
      <li data-cls="f@3:on">Attendre le recalcul</li>
    </ul>
  </div>
  <div class="doc" data-in="e@4" data-a="drop" data-r="5" data-wig="1.5" style="left:620px;top:400px;width:260px;height:320px">
    <svg class="leaf" viewBox="0 0 24 24"><path d="M12 2 L13.6 6.2 L16.2 5.2 L15.2 10 L19.2 8.2 L18.2 11.2 L21.5 12.2 L17.4 15.2 L18.4 17.4 L13.1 16.4 L12.7 21.5 L11.3 21.5 L10.9 16.4 L5.6 17.4 L6.6 15.2 L2.5 12.2 L5.8 11.2 L4.8 8.2 L8.8 10 L7.8 5.2 L10.4 6.2 Z" fill="#cc1627"/></svg>
    <div class="k">Canada</div>
    <div class="t">Résidence permanente</div>
    <div class="lines"><span></span><span style="width:70%"></span></div>
  </div>
  <div data-in="f@1" data-a="left" style="left:70px;top:720px;width:540px;height:240px">
    <div class="timeline">
      <div class="step on"><div><div class="d">3 nov.</div><div class="e">Entrée en vigueur</div></div></div>
      <div class="step" data-cls="f@6:on"><div><div class="d">~ 17 nov.</div><div class="e">Reprise des rondes</div></div></div>
    </div>
  </div>
</div>

<div class="scene" data-scene="4">
  <div class="logo" data-in="g" data-a="pop" style="left:70px;top:350px;width:300px;height:226px"></div>
  <div class="url" data-in="g@4" data-a="up" style="left:70px;top:620px;width:760px;height:50px">www.stanzy-immigration-consulting.com</div>
  <div class="cta" data-in="h@2" data-a="pop" data-pulse style="left:70px;top:700px;width:640px;height:104px">Écrivez-nous sur WhatsApp →</div>
  <div class="hand" data-in="h@4" data-a="fade" data-r="-2" style="left:100px;top:840px;width:520px;height:70px">+237 679 306 015</div>
</div>
`;
