// 1. Supabase 설정 (변수명을 sb로 변경하여 충돌 방지)
const SB_URL = 'https://quqnmzarcrhwbdokfsgz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cW5temFyY3Jod2Jkb2tmc2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTc3ODQsImV4cCI6MjA4MjA5Mzc4NH0.ZBjfXMX3bKk6vJRmsb49MkV3Lq-O5stujPWk_44-kdc';

let sb;
try {
    // CDN에서 제공하는 supabase 객체를 사용하여 클라이언트 생성
    sb = supabase.createClient(SB_URL, SB_KEY);
    console.log("Supabase 연결 성공");
} catch (e) {
    alert("Supabase 초기화 에러: " + e.message);
}

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
        target.style.display = (viewName === 'chat') ? 'flex' : 'block';
    }

    if (viewName === 'chat') {
        document.getElementById('user-display').innerText = currentUser;
    }
}

// 4. 초기화 및 이벤트 연결
document.addEventListener('DOMContentLoaded', () => {
    // 현재 접속 모드 설정
    if (currentUser) {
        showView('chat');
        initChat();
    } else {
        showView('login');
    }

    // [이벤트 연결] - ID가 정확히 일치해야 함
    const connectClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };

    connectClick('go-to-signup', () => showView('signup'));
    connectClick('go-to-login', () => showView('login'));
    connectClick('btn-login', handleLogin);
    connectClick('btn-signup', handleSignup);
    connectClick('btn-logout', handleLogout);
    connectClick('btn-send', handleSendMessage);

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.onkeypress = (e) => { if (e.key === 'Enter') handleSendMessage(); };
    }
});

// 5. 기능 함수 (로그인/회원가입 등)
async function handleLogin() {
    const id = document.getElementById('login-id').value.trim();
    const pw = document.getElementById('login-pw').value.trim();
    if (!id || !pw) return alert("입력칸을 채워주세요.");

    const { data, error } = await sb.from('profiles').select('*').eq('username', id).eq('password', pw);
    
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

    const { data: exist } = await sb.from('profiles').select('*').eq('username', id);
    if (exist && exist.length > 0) return alert("이미 있는 아이디입니다.");

    const { error } = await sb.from('profiles').insert([{ username: id, password: pw }]);
    if (!error) {
        alert("가입 성공! 로그인 하세요.");
        showView('login');
    } else {
        alert("가입 실패: " + error.message);
    }
}

// 6. 채팅 로직
function initChat() {
    loadChatHistory();
    sb.channel('global-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => renderMessage(p.new))
      .subscribe();
}

async function loadChatHistory() {
    const { data } = await sb.from('messages').select('*').order('created_at', { ascending: true });
    const chatBox = document.getElementById('chat-box');
    if (chatBox) chatBox.innerHTML = '';
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
    if (!box) return;
    const isMe = m.username === currentUser;
    const div = document.createElement('div');
    div.style.alignSelf = isMe ? 'flex-end' : 'flex-start';
    div.innerHTML = `
        <div style="font-size:10px; color:#999; margin-bottom:2px;">${m.username}</div>
        <div style="background:${isMe ? '#10b981' : '#fff'}; color:${isMe ? '#fff' : '#333'}; padding:10px; border-radius:15px; margin-bottom:10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width:250px;">
            ${m.content}
        </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function handleLogout() {
    localStorage.removeItem('sb_user');
    location.reload();
}
