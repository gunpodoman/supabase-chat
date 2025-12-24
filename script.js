const SB_URL = 'https://quqnmzarcrhwbdokfsgz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cW5temFyY3Jod2Jkb2tmc2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTc3ODQsImV4cCI6MjA4MjA5Mzc4NH0.ZBjfXMX3bKk6vJRmsb49MkV3Lq-O5stujPWk_44-kdc';
const sb = supabase.createClient(SB_URL, SB_KEY);

let user = localStorage.getItem('sb_user_v3');
let isSignup = false;

document.addEventListener('DOMContentLoaded', () => {
    if(user) loginSuccess(user);
    initApp();
});

function initApp() {
    // 버튼 연결
    document.getElementById('btn-auth-submit').onclick = handleAuth;
    document.getElementById('btn-auth-toggle').onclick = () => {
        isSignup = !isSignup;
        document.getElementById('auth-title').innerText = isSignup ? "Create Account" : "Welcome";
        document.getElementById('btn-auth-submit').innerText = isSignup ? "가입하기" : "시작하기";
    };
    
    // [중요] 입력창 이벤트: 타이핑 차단 방지를 위해 표준 리스너 사용
    const inputEl = document.getElementById('msg-input');
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            send();
        }
    });
    document.getElementById('btn-send').onclick = send;
}

async function handleAuth() {
    const id = document.getElementById('id-input').value.trim();
    const pw = document.getElementById('pw-input').value.trim();
    if(!id || !pw) return alert("내용을 입력하세요.");

    if(isSignup) {
        const { error } = await sb.from('profiles').insert([{ username: id, password: pw }]);
        if(!error) { alert("가입 성공! 로그인하세요."); location.reload(); }
        else alert("이미 있는 아이디거나 오류입니다.");
    } else {
        const { data } = await sb.from('profiles').select('*').eq('username', id).eq('password', pw);
        if(data?.length > 0) loginSuccess(id);
        else alert("정보가 일치하지 않습니다.");
    }
}

function loginSuccess(id) {
    user = id;
    localStorage.setItem('sb_user_v3', id);
    
    // [핵심] 로그인 레이어를 완전히 제거하여 입력창 클릭을 방해하지 못하게 함
    const authLayer = document.getElementById('view-auth');
    if(authLayer) authLayer.remove(); 
    
    document.getElementById('current-user-name').innerText = id;
    if(id === 'admin') document.getElementById('nav-admin').classList.remove('hidden');
    
    loadChat();
}

async function loadChat() {
    const { data } = await sb.from('messages').select('*').order('created_at', { ascending: true });
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    data?.forEach(renderMsg);
    box.scrollTop = box.scrollHeight;

    // 실시간 리스너
    sb.channel('public').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => renderMsg(p.new)).subscribe();
}

async function send() {
    const input = document.getElementById('msg-input');
    const content = input.value.trim();
    if(!content) return;
    
    input.value = ''; // 즉시 비우기
    input.focus(); // 아이패드 키보드 유지
    
    const { error } = await sb.from('messages').insert([{ username: user, content }]);
    if(error) alert("전송 실패: Supabase RLS 설정을 확인하세요.");
}

function renderMsg(m) {
    const box = document.getElementById('chat-box');
    const isMe = m.username === user;
    const div = document.createElement('div');
    div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4`;
    div.innerHTML = `
        <span class="text-[10px] text-slate-400 font-bold mb-1 px-2">${m.username}</span>
        <div class="bubble ${isMe ? 'my-bubble' : 'other-bubble shadow-sm'}">${m.content}</div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// [관리자 모드 로직]
async function loadAdmin() {
    const { data: users } = await sb.from('profiles').select('*');
    const { data: msgs } = await sb.from('messages').select('*').order('created_at', { descending: true });
    
    document.getElementById('admin-stats').innerHTML = `
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p class="text-xs font-bold text-slate-400 uppercase">Total Users</p>
            <p class="text-3xl font-black">${users?.length || 0}</p>
        </div>
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p class="text-xs font-bold text-slate-400 uppercase">Total Messages</p>
            <p class="text-3xl font-black">${msgs?.length || 0}</p>
        </div>
    `;

    document.getElementById('admin-list').innerHTML = msgs.slice(0, 15).map(m => `
        <div class="flex justify-between items-center p-4 hover:bg-white rounded-2xl transition">
            <span class="text-sm"><b>${m.username}</b>: ${m.content}</span>
            <button onclick="deleteMsg(${m.id})" class="text-rose-500 font-bold text-xs bg-rose-50 px-3 py-1 rounded-lg">삭제</button>
        </div>
    `).join('');
}

async function deleteMsg(id) {
    if(!confirm("삭제하시겠습니까?")) return;
    await sb.from('messages').delete().eq('id', id);
    loadAdmin();
}

function changeTab(tab) {
    document.getElementById('tab-chat').classList.toggle('hidden', tab !== 'chat');
    document.getElementById('tab-admin').classList.toggle('hidden', tab !== 'admin');
    document.getElementById('nav-chat').classList.toggle('active', tab === 'chat');
    document.getElementById('nav-admin').classList.toggle('active', tab === 'admin');
    if(tab === 'admin') loadAdmin();
}

function logout() { localStorage.clear(); location.reload(); }
