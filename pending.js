/* ============================================================
   MIIRAGIC 積點「待審核」查詢 — 給入口網站、業績系統、行政後台共用
   用法：<script src="https://kevin87265-pixel.github.io/portal/pending.js"></script>
         const r = await MiiragicPending.mine();       // 我（這位老師）要審幾筆
         const list = await MiiragicPending.byReferrer(); // 每位老師各要審幾筆（管理員登入時才有全部）
   原理：同一個網站（kevin87265-pixel.github.io）底下共用積點系統的登入通行證；
         這台裝置有登入過積點系統（12 小時內有用過）就讀得到，沒有就回 reason:"login"。
   ============================================================ */
(function(w){
  var SUPA_URL = "https://plgrsxtlaznajzqgcuqr.supabase.co";
  var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsZ3JzeHRsYXpuYWp6cWdjdXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5Njg1MDIsImV4cCI6MjA5MDU0NDUwMn0.XyZ0wQbZQ-CInglRpv-MHMuMvkviRovm-o-On_FeyGs";
  var POINTS_URL = "https://kevin87265-pixel.github.io/miiragic-points/";
  var cache = null, cacheAt = 0;

  function token(){
    try{ return localStorage.getItem("miiragic_token") || sessionStorage.getItem("miiragic_token") || ""; }catch(e){ return ""; }
  }
  async function load(){
    if(cache && Date.now() - cacheAt < 60000) return cache;           // 一分鐘內不重複抓
    var t = token();
    if(!t) return { ok:false, reason:"login" };
    try{
      var res = await fetch(SUPA_URL + "/rest/v1/rpc/mg_load", {
        method:"POST", cache:"no-store", credentials:"omit", referrerPolicy:"no-referrer",
        headers:{ "apikey":SUPA_KEY, "Authorization":"Bearer "+SUPA_KEY, "Content-Type":"application/json" },
        body: JSON.stringify({ p_token:t })
      });
      var j = null; try{ j = await res.json(); }catch(e){}
      if(!res.ok || !j || !j.ok){
        var msg = (j && ((j.error && j.error.message) || j.message)) || "";
        return { ok:false, reason: /AUTH|token|登入/i.test(msg) || res.status===401 ? "login" : "error" };
      }
      cache = { ok:true, data:j.data || {}, account:j.account || {} }; cacheAt = Date.now();
      return cache;
    }catch(e){ return { ok:false, reason:"error" }; }
  }
  function team(d, rid){                     // 這位推薦人＋他下面所有推薦人的學員
    var students = d.students || [], accounts = d.accounts || [];
    var refIds = [rid], queue = [rid], seen = {}; seen[rid] = 1;
    while(queue.length){
      var cur = queue.shift();
      students.forEach(function(s){
        if(s.admin_id !== cur) return;
        var a = accounts.find(function(x){ return x.type==="both" && x.linked_student_id===s.id; });
        if(a && a.linked_id && !seen[a.linked_id]){ seen[a.linked_id]=1; refIds.push(a.linked_id); queue.push(a.linked_id); }
      });
    }
    return students.filter(function(s){ return refIds.indexOf(s.admin_id) > -1; }).map(function(s){ return s.id; });
  }
  function count(d, sids){
    var f = function(arr){ return (arr||[]).filter(function(r){ return r.status==="pending" && (!sids || sids.indexOf(r.sid) > -1); }).length; };
    var e = f(d.earn_records), p = f(d.pv_records), r = f(d.redeem_records);
    return { e:e, p:p, r:r, total:e+p+r };
  }

  w.MiiragicPending = {
    POINTS_URL: POINTS_URL,
    /* 我要審幾筆：{ok, name, total, e(積點), p(業績), r(兌換)}；沒登入 {ok:false, reason:"login"} */
    mine: async function(){
      var L = await load(); if(!L.ok) return L;
      var acc = L.account || {}, d = L.data;
      if(acc.type !== "ref" && acc.type !== "both") return { ok:true, name:"", total:0, e:0, p:0, r:0, notReferrer:true };
      var rid = acc.linked_id;
      var ref = (d.referrers||[]).find(function(x){ return x.id===rid; });
      var c = count(d, team(d, rid));
      return { ok:true, name: ref ? ref.name : "", total:c.total, e:c.e, p:c.p, r:c.r };
    },
    /* 每位老師要審幾筆（以學員的直屬推薦人計）：[{name,total}]，由多到少 */
    byReferrer: async function(){
      var L = await load(); if(!L.ok) return L;
      var d = L.data, by = {};
      var stu = {}; (d.students||[]).forEach(function(s){ stu[s.id] = s; });
      var ref = {}; (d.referrers||[]).forEach(function(r){ ref[r.id] = r.name; });
      ["earn_records","pv_records","redeem_records"].forEach(function(k){
        (d[k]||[]).forEach(function(r){
          if(r.status !== "pending") return;
          var s = stu[r.sid]; var n = s && ref[s.admin_id]; if(!n) return;
          by[n] = (by[n]||0) + 1;
        });
      });
      var list = Object.keys(by).map(function(n){ return { name:n, total:by[n] }; }).sort(function(a,b){ return b.total-a.total; });
      return { ok:true, isAdmin: (L.account||{}).type==="admin", list:list };
    }
  };
})(window);
