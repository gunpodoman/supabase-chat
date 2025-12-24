// 1. Supabase 설정
const SB_URL = 'https://quqnmzarcrhwbdokfsgz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cW5temFyY3Jod2Jkb2tmc2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTc3ODQsImV4cCI6MjA4MjA5Mzc4NH0.ZBjfXMX3bKk6vJRmsb49MkV3Lq-O5stujPWk_44-kdc';

let sb = supabase.createClient(SB_URL, SB_KEY);

// 2. 상태 관리
let currentUser = localStorage.getItem('sb_user');

// 3. 화면 전환 함수
function showView(viewName) {
    const views = ['view-login', 'view-signup', 'view-chat'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.style.display = 'none';
    });

    const target = document.getElementById('view-' + viewName);
    if (target) {
        // 채팅창일때만 flex, 아니면 block
        target.style.display = (viewName === 'chat') ? 'flex' : 'block';
    }

    if (viewName === 'chat') {
        document.getElementById('user-display').innerText = currentUser;
    }
}

// 4. 초기화 및 이벤트 연결
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showView('chat');
        initChat();
    } else {
        showView('login');
    }

    document.getElementById('go-to-signup').onclick = () => showView('signup');
    document.getElementById('go-to-login').onclick = () => showView('login');
    document.getElementById('btn-login').onclick = handleLogin;
    document.getElementById('btn-signup').onclick = handleSignup;
    document.getElementById('btn-logout').onclick = handleLogout;
    document.getElementById('btn-send').onclick = handleSendMessage;
    document.getElementById('chat-input').onkeypress = (e) => { if (e.key === 'Enter') handleSendMessage(); };
});

async function handleLogin() {
    const id = document.getElementById('login-id').value.trim();
    const pw = document.getElementById('login-pw').value.trim();
    if (!id || !pw) return alert("입력칸을 채워주세요.");

    const { data } = await sb.from('profiles').select('*').eq('username', id).eq('password', pw);
    if (data && data.length > 0) {
        currentUser = id;
        localStorage.setItem('sb_user', id);
        showView('chat');
        initChat();
    } else {
        alert("정보가 일치하지 않습니다.");
    }
}

async function handleSignup() {
    const id = document.getElementById('signup-id').value.trim();
    const pw = document.getElementById('signup-pw').value.trim();
    if (!id || !pw) return alert("정보를 입력하세요.");

    const { error } = await sb.from('profiles').insert([{ username: id, password: pw }]);
    if (!error) {
        alert("가입 성공!");
        showView('login');
    } else {
        alert("가입 실패: " + error.message);
    }
}

function initChat() {
    loadChatHistory();
    sb.channel('global-chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => renderMessage(p.new)).subscribe();
}

async function loadChatHistory() {
    const { data } = await sb.from('messages').select('*').order('created_at', { ascending: true });
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';
    if (data) data.forEach(renderMessage);
}

async function handleSendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    await sb.from('messages').insert([{ username: currentUser, content: content }]);
}

function renderMessage(m) {
    const box = document.getElementById('chat-box');
    const isMe = m.username === currentUser;
    const div = document.createElement('div');
    div.className = `message-wrapper ${isMe ? 'me' : 'other'}`;
    div.innerHTML = `
        <div class="user-name">${m.username}</div>
        <div class="bubble">${m.content}</div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function handleLogout() {
    localStorage.removeItem('sb_user');
    location.reload();
}
