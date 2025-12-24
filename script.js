const SB_URL = 'https://quqnmzarcrhwbdokfsgz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cW5temFyY3Jod2Jkb2tmc2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTc3ODQsImV4cCI6MjA4MjA5Mzc4NH0.ZBjfXMX3bKk6vJRmsb49MkV3Lq-O5stujPWk_44-kdc';
const sb = supabase.createClient(SB_URL, SB_KEY);

let currentUser = localStorage.getItem('sb_user');
let isSignupMode = false;

document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) loginSuccess(currentUser);
    initEvents();
});

// [기능] 화면 탭 전환
function switchTab(tab) {
    document.getElementById('tab-chat').classList.toggle('hidden', tab !== 'chat');
    document.getElementById('tab-admin').classList.toggle('hidden', tab !== 'admin');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    if (tab === 'admin') loadAdminDashboard();
}

// [기능] 로그인/가입 처리
async function handleAuth() {
    const id = document.getElementById('id-input').value.trim();
    const pw = document.getElementById('pw-input').value.trim();
    if(!id || !pw) return alert("빈칸을 채워주세요.");

    if (isSignupMode) {
        const { error } = await sb.from('profiles').insert([{ username: id, password: pw }]);
        if (!error) { alert("가입 완료! 로그인 해주세요."); toggleAuth(); }
        else alert("가입 실패: " + error.message);
    } else {
        const { data } = await sb.from('profiles').select('*').eq('username', id).eq('password', pw);
        if (data?.length > 0) loginSuccess(id);
        else alert("정보가 일치하지 않습니다.");
    }
}

function loginSuccess(userId) {
    currentUser = userId;
    localStorage.setItem('sb_user', userId);
    document.getElementById('view-auth').classList.add('hidden');
    document.getElementById('display-name').innerText = userId;
    
    // 관리자 체크 (admin/admin)
    if (userId === 'admin') {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('role-tag').innerText = 'Administrator';
        document.getElementById('role-tag').className = 'text-[10px] bg-amber-100 px-2 py-0.5 rounded text-amber-600 font-bold';
    }

    initChat();
}

// [채팅] 실시간 로직
async function initChat() {
    loadMessages();
    sb.channel('global').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => renderMsg(p.new)).subscribe();
}

async function loadMessages() {
    const { data } = await sb.from('messages').select('*').order('created_at', { ascending: true });
    document.getElementById('chat-box').innerHTML = '';
    if (data) data.forEach(renderMsg);
}

async function sendMsg() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;
    
    input.value = ''; // 즉시 비우기 (사용자 경험)
    const { error } = await sb.from('messages').insert([{ username: currentUser, content: content }]);
    if (error) alert("메시지 전송 실패: " + error.message);
}

function renderMsg(m) {
    const box = document.getElementById('chat-box');
    const isMe = m.username === currentUser;
    const div = document.createElement('div');
    div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4`;
    div.innerHTML = `
        <span class="text-[10px] text-gray-400 mb-1 px-2">${m.username}</span>
        <div class="bubble ${isMe ? 'bubble-me' : 'bubble-other'}">${m.content}</div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// [관리자] 대시보드 로직
async function loadAdminDashboard() {
    const { data: users } = await sb.from('profiles').select('*');
    const { data: msgs } = await sb.from('messages').select('*').order('created_at', { descending: true });

    document.getElementById('count-users').innerText = users?.length || 0;
    document.getElementById('count-msgs').innerText = msgs?.length || 0;

    // 유저 리스트 렌더링
    const userDiv = document.getElementById('admin-user-list');
    userDiv.innerHTML = users.map(u => `
        <div class="flex justify-between p-4 bg-gray-50 rounded-xl">
            <span class="font-bold">${u.username}</span>
            <span class="text-gray-400 text-xs">PW: ${u.password}</span>
        </div>
    `).join('');

    // 메시지 삭제 리스트
    const msgDiv = document.getElementById('admin-msg-list');
    msgDiv.innerHTML = msgs.slice(0, 10).map(m => `
        <div class="flex justify-between items-center p-3 border-b text-xs">
            <span><b>${m.username}</b>: ${m.content}</span>
            <button onclick="deleteMsg(${m.id})" class="text-rose-500 font-bold">삭제</button>
        </div>
    `).join('');
}

async function deleteMsg(id) {
    if (!confirm("이 메시지를 삭제할까요?")) return;
    const { error } = await sb.from('messages').delete().eq('id', id);
    if (!error) loadAdminDashboard();
}

// [기본] 이벤트 바인딩
function initEvents() {
    document.getElementById('btn-main-auth').onclick = handleAuth;
    document.getElementById('btn-send').onclick = sendMsg;
    document.getElementById('message-input').onkeypress = (e) => e.key === 'Enter' && sendMsg();
    document.getElementById('btn-logout').onclick = () => { localStorage.clear(); location.reload(); };
    document.getElementById('btn-toggle-auth').onclick = toggleAuth;
}

function toggleAuth() {
    isSignupMode = !isSignupMode;
    document.getElementById('auth-title').innerText = isSignupMode ? "Sign Up" : "Welcome";
    document.getElementById('btn-main-auth').innerText = isSignupMode ? "회원가입 하기" : "접속하기";
    document.getElementById('btn-toggle-auth').innerText = isSignupMode ? "이미 계정이 있나요? 로그인" : "계정이 없으신가요? 회원가입";
}
