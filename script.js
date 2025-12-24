// 1. 설정 정보
const SB_URL = 'https://quqnmzarcrhwbdokfsgz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cW5temFyY3Jod2Jkb2tmc2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTc3ODQsImV4cCI6MjA4MjA5Mzc4NH0.ZBjfXMX3bKk6vJRmsb49MkV3Lq-O5stujPWk_44-kdc';
const supabase = supabase.createClient(SB_URL, SB_KEY);

// 2. DOM 요소들
const views = {
    login: document.getElementById('view-login'),
    signup: document.getElementById('view-signup'),
    chat: document.getElementById('view-chat')
};

const inputs = {
    loginId: document.getElementById('login-id'),
    loginPw: document.getElementById('login-pw'),
    signupId: document.getElementById('signup-id'),
    signupPw: document.getElementById('signup-pw'),
    chatInput: document.getElementById('chat-input')
};

// 3. 상태 관리
let currentUser = localStorage.getItem('sb_user');

// 4. 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showView('chat');
        initChat();
    }
    setupEventListeners();
});

// 5. 화면 전환 함수
function showView(viewName) {
    Object.values(views).forEach(view => view.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    
    if (viewName === 'chat') {
        document.getElementById('user-display').innerText = currentUser;
    }
}

// 6. 이벤트 리스너 설정 (작동 안 하는 문제 해결 핵심)
function setupEventListeners() {
    // 화면 전환 버튼들
    document.getElementById('go-to-signup').onclick = () => showView('signup');
    document.getElementById('go-to-login').onclick = () => showView('login');

    // 기능 버튼들
    document.getElementById('btn-signup').onclick = handleSignup;
    document.getElementById('btn-login').onclick = handleLogin;
    document.getElementById('btn-logout').onclick = handleLogout;
    document.getElementById('btn-send').onclick = handleSendMessage;
    
    // 엔터키 처리
    inputs.chatInput.onkeypress = (e) => { if (e.key === 'Enter') handleSendMessage(); };
}

// 7. 회원가입 처리
async function handleSignup() {
    const id = inputs.signupId.value.trim();
    const pw = inputs.signupPw.value.trim();

    if (!id || !pw) return alert("정보를 입력하세요.");

    const { data: exist } = await supabase.from('profiles').select('*').eq('username', id);
    if (exist && exist.length > 0) return alert("이미 있는 아이디입니다.");

    const { error } = await supabase.from('profiles').insert([{ username: id, password: pw }]);
    if (!error) {
        alert("가입 성공! 로그인 하세요.");
        showView('login');
    } else {
        alert("오류: " + error.message);
    }
}

// 8. 로그인 처리
async function handleLogin() {
    const id = inputs.loginId.value.trim();
    const pw = inputs.loginPw.value.trim();

    const { data, error } = await supabase.from('profiles').select('*').eq('username', id).eq('password', pw);
    
    if (data && data.length > 0) {
        currentUser = id;
        localStorage.setItem('sb_user', id);
        showView('chat');
        initChat();
    } else {
        alert("아이디 또는 비밀번호가 틀립니다.");
    }
}

// 9. 채팅 실시간 로직
function initChat() {
    loadChatHistory();
    // 중복 구독 방지를 위해 채널명 고유화
    supabase.channel('room-1')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => renderMessage(p.new))
        .subscribe();
}

async function loadChatHistory() {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ''; // 초기화
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) data.forEach(renderMessage);
}

async function handleSendMessage() {
    const content = inputs.chatInput.value.trim();
    if (!content) return;
    
    inputs.chatInput.value = '';
    const { error } = await supabase.from('messages').insert([{ username: currentUser, content: content }]);
    if (error) alert("전송 실패: " + error.message);
}

function renderMessage(m) {
    const box = document.getElementById('chat-box');
    const isMe = m.username === currentUser;
    
    const wrapper = document.createElement('div');
    wrapper.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2`;
    
    wrapper.innerHTML = `
        <span class="text-[10px] text-gray-400 mb-1 px-1">${m.username}</span>
        <div class="msg-bubble ${isMe ? 'bg-emerald-500 text-white' : 'bg-white text-gray-800'}">
            ${m.content}
        </div>
    `;
    
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
}

function handleLogout() {
    localStorage.removeItem('sb_user');
    location.reload();
}
