(function() {
    'use strict';

    // [1] 시스템 설정 및 상태 관리
    const CONFIG = {
        SB_URL: 'https://quqnmzarcrhwbdokfsgz.supabase.co',
        SB_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cW5temFyY3Jod2Jkb2tmc2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTc3ODQsImV4cCI6MjA4MjA5Mzc4NH0.ZBjfXMX3bKk6vJRmsb49MkV3Lq-O5stujPWk_44-kdc',
        VERSION: '1.5.0',
        DEBUG: false
    };

    const STATE = {
        user: localStorage.getItem('sb_user_v3'),
        currentTab: 'chat',
        isSignupMode: false,
        lastScrollPos: 0,
        isSyncing: false,
        realtimeChannel: null
    };

    // Supabase 클라이언트 초기화
    const sb = supabase.createClient(CONFIG.SB_URL, CONFIG.SB_KEY);

    /**
     * DOM 유틸리티 함수 - 안전한 요소 접근
     */
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    /**
     * [2] 초기화 시스템
     */
    const init = () => {
        log('System Initializing...');
        
        // 브라우저 캐시 및 환경 체크
        checkEnvironment();
        
        // 이벤트 바인딩
        bindGlobalEvents();
        
        // 로그인 세션 확인
        if (STATE.user) {
            loginSuccess(STATE.user);
        } else {
            showAuthOverlay();
        }

        log('System Ready.');
    };

    const log = (msg) => {
        if (CONFIG.DEBUG) console.log(`[ChatHub] ${msg}`);
    };

    const checkEnvironment = () => {
        // 아이패드 세이프 에어리어 및 높이 보정
        const setDocHeight = () => {
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        };
        window.addEventListener('resize', setDocHeight);
        setDocHeight();
    };

    /**
     * [3] 이벤트 바인딩 시스템
     * 아이패드의 입력 버그를 방지하기 위해 중복 이벤트를 차단하고 표준 리스너를 사용합니다.
     */
    const bindGlobalEvents = () => {
        // 로그인 제출
        $('#btn-auth-submit').addEventListener('click', handleAuthAction);

        // 엔터키 처리 (로그인)
        $('#id-input').addEventListener('keypress', (e) => e.key === 'Enter' && $('#pw-input').focus());
        $('#pw-input').addEventListener('keypress', (e) => e.key === 'Enter' && handleAuthAction());

        // 회원가입 모드 전환
        $('#btn-auth-toggle').addEventListener('click', toggleAuthMode);

        // 채팅 전송 (클릭)
        $('#btn-send').addEventListener('click', (e) => {
            e.preventDefault();
            processSendMessage();
        });

        // 채팅 전송 (엔터키 - 아이패드 가상 키보드 대응)
        $('#msg-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                if (!e.isComposing) { // 한글 끝글자 중복 방지
                    e.preventDefault();
                    processSendMessage();
                }
            }
        });

        // 탭 전환 감시
        log('Events Bound.');
    };

    /**
     * [4] 인증 시스템 (Auth Logic)
     */
    async function handleAuthAction() {
        const id = $('#id-input').value.trim();
        const pw = $('#pw-input').value.trim();

        if (!id || !pw) {
            showToast('아이디와 비밀번호를 입력해주세요.', 'error');
            return;
        }

        toggleLoading(true);

        try {
            if (STATE.isSignupMode) {
                // 회원가입 프로세스
                const { error } = await sb.from('profiles').insert([{ username: id, password: pw }]);
                if (error) throw error;
                showToast('회원가입 성공! 로그인 해주세요.', 'success');
                toggleAuthMode();
            } else {
                // 로그인 프로세스
                const { data, error } = await sb.from('profiles')
                    .select('*')
                    .eq('username', id)
                    .eq('password', pw);

                if (error) throw error;
                if (data && data.length > 0) {
                    loginSuccess(id);
                } else {
                    showToast('정보가 일치하지 않습니다.', 'error');
                }
            }
        } catch (err) {
            console.error('Auth Error:', err);
            showToast(err.message || '인증 오류 발생', 'error');
        } finally {
            toggleLoading(false);
        }
    }

    function loginSuccess(userId) {
        STATE.user = userId;
        localStorage.setItem('sb_user_v3', userId);

        // [중요] 아이패드 입력 방해 레이어 제거
        const authOverlay = $('#view-auth');
        if (authOverlay) {
            authOverlay.style.opacity = '0';
            setTimeout(() => authOverlay.remove(), 500); // DOM에서 완전히 삭제
        }

        // 프로필 업데이트
        $('#display-user-id').innerText = userId;
        $('#current-user-display').innerText = userId;
        
        // 관리자 권한 체크
        if (userId === 'admin') {
            $('#nav-admin').classList.remove('hidden');
        }

        // 채팅 시스템 가동
        initChatSystem();
        showToast(`${userId}님, 환영합니다!`, 'success');
    }

    function toggleAuthMode() {
        STATE.isSignupMode = !STATE.isSignupMode;
        $('#auth-title').innerText = STATE.isSignupMode ? 'Create Account' : 'Chat Hub';
        $('#auth-subtitle').innerText = STATE.isSignupMode ? '새로운 계정을 생성합니다' : '프리미엄 대시보드에 로그인하세요';
        $('#btn-auth-submit').innerText = STATE.isSignupMode ? '가입하기' : '접속하기';
        $('#btn-auth-toggle').innerText = STATE.isSignupMode ? '이미 계정이 있나요? 로그인' : '신규 사용자이신가요? 회원가입';
    }

    /**
     * [5] 채팅 시스템 (Messaging Logic)
     */
    async function initChatSystem() {
        if (STATE.isSyncing) return;
        STATE.isSyncing = true;

        try {
            // 1. 기존 메시지 로드 (최근 50개)
            const { data, error } = await sb.from('messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;

            const box = $('#chat-content');
            box.innerHTML = ''; // 초기화
            
            if (data) {
                data.forEach(msg => appendMessageUI(msg));
            }
            
            scrollToBottom();
            
            // 2. 실시간 구독 설정 (Channel API v2)
            if (STATE.realtimeChannel) sb.removeChannel(STATE.realtimeChannel);
            
            STATE.realtimeChannel = sb.channel('public_room')
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages' 
                }, payload => {
                    appendMessageUI(payload.new);
                    scrollToBottom();
                })
                .subscribe();

        } catch (err) {
            showToast('채팅 로드 실패', 'error');
        } finally {
            STATE.isSyncing = false;
        }
    }

    async function processSendMessage() {
        const input = $('#msg-input');
        const content = input.value.trim();

        if (!content) return;
        if (!STATE.user) return showToast('로그인이 필요합니다.', 'error');

        // UI 즉시 반응 (Optimistic Update 미적용, 안정성 우선)
        input.value = '';
        
        // 아이패드에서 포커스를 유지하여 키보드가 내려가지 않게 함
        input.focus();

        try {
            const { error } = await sb.from('messages').insert([
                { username: STATE.user, content: content }
            ]);

            if (error) throw error;
        } catch (err) {
            showToast('메시지 전송 실패', 'error');
            input.value = content; // 실패 시 복구
        }
    }

    function appendMessageUI(msg) {
        const box = $('#chat-content');
        const isMe = msg.username === STATE.user;
        
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isMe ? 'items-end' : 'items-start'}`;
        
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        wrapper.innerHTML = `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]">
                <span class="text-[10px] font-black text-slate-400 mb-1 px-2 uppercase tracking-tighter">
                    ${msg.username} <span class="font-normal lowercase ml-1 opacity-60">${time}</span>
                </span>
                <div class="bubble ${isMe ? 'my-bubble' : 'other-bubble shadow-sm'}">
                    ${escapeHtml(msg.content)}
                </div>
            </div>
        `;

        box.appendChild(wrapper);
    }

    /**
     * [6] 관리자 시스템 (Admin Logic)
     */
    async function refreshAdminData() {
        if (STATE.user !== 'admin') return;

        try {
            // 통계 데이터 동시 요청
            const [usersRes, msgsRes] = await Promise.all([
                sb.from('profiles').select('*', { count: 'exact' }),
                sb.from('messages').select('*', { count: 'exact' }).order('created_at', { descending: true })
            ]);

            if (usersRes.error) throw usersRes.error;
            if (msgsRes.error) throw msgsRes.error;

            // 대시보드 UI 업데이트
            renderAdminStats(usersRes.count, msgsRes.count);
            renderAdminLogs(msgsRes.data);

        } catch (err) {
            showToast('관리자 데이터 갱신 실패', 'error');
        }
    }

    function renderAdminStats(userCount, msgCount) {
        const container = $('#admin-summary');
        container.innerHTML = `
            <div class="admin-card bg-white">
                <p class="text-[10px] font-black text-emerald-600 uppercase mb-2">Total Users</p>
                <h4 class="text-4xl font-black text-slate-800">${userCount}</h4>
                <div class="w-full h-1 bg-emerald-100 mt-4 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 w-[70%]"></div>
                </div>
            </div>
            <div class="admin-card bg-white">
                <p class="text-[10px] font-black text-blue-600 uppercase mb-2">Message Volume</p>
                <h4 class="text-4xl font-black text-slate-800">${msgCount}</h4>
                <div class="w-full h-1 bg-blue-100 mt-4 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 w-[45%]"></div>
                </div>
            </div>
            <div class="admin-card bg-white">
                <p class="text-[10px] font-black text-rose-600 uppercase mb-2">Server Status</p>
                <h4 class="text-4xl font-black text-slate-800">Stable</h4>
                <p class="text-xs text-slate-400 mt-4 font-bold">Uptime: 99.9%</p>
            </div>
        `;
    }

    function renderAdminLogs(messages) {
        const list = $('#admin-log-list');
        list.innerHTML = messages.slice(0, 30).map(m => `
            <div class="log-item group">
                <div class="flex flex-col">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-black text-slate-800">${m.username}</span>
                        <span class="text-[10px] text-slate-400 font-medium">${new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <p class="text-sm text-slate-600">${escapeHtml(m.content)}</p>
                </div>
                <button onclick="window.ChatApp.deleteMessage(${m.id})" 
                        class="opacity-0 group-hover:opacity-100 transition-all p-2 bg-rose-50 text-rose-500 rounded-lg font-bold text-xs hover:bg-rose-500 hover:text-white">
                    DELETE
                </button>
            </div>
        `).join('');
    }

    window.ChatApp = {
        deleteMessage: async (id) => {
            if (!confirm('정말 이 메시지를 삭제하시겠습니까?')) return;
            const { error } = await sb.from('messages').delete().eq('id', id);
            if (!error) {
                showToast('메시지가 삭제되었습니다.', 'success');
                refreshAdminData();
            }
        }
    };

    /**
     * [7] UI 보조 기능 (Utility UI)
     */
    window.changeTab = (tab) => {
        STATE.currentTab = tab;
        
        // 탭 가시성
        $('#tab-chat').classList.toggle('hidden', tab !== 'chat');
        $('#tab-admin').classList.toggle('hidden', tab !== 'admin');
        
        // 버튼 스타일
        $('#nav-chat').classList.toggle('active', tab === 'chat');
        $('#nav-admin').classList.toggle('active', tab === 'admin');

        if (tab === 'admin') refreshAdminData();
        if (tab === 'chat') scrollToBottom();
    };

    window.handleLogout = () => {
        if (confirm('시스템에서 로그아웃 하시겠습니까?')) {
            localStorage.clear();
            location.reload();
        }
    };

    function scrollToBottom() {
        const box = $('#chat-content');
        box.scrollTop = box.scrollHeight;
    }

    function toggleLoading(isLoading) {
        const btn = $('#btn-auth-submit');
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<span class="animate-spin">🌀</span> 처리 중...`;
        } else {
            btn.disabled = false;
            btn.innerText = STATE.isSignupMode ? '가입하기' : '접속하기';
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm transition-all duration-500 transform translate-y-20 opacity-0`;
        
        const colors = {
            success: 'bg-emerald-600 text-white',
            error: 'bg-rose-600 text-white',
            info: 'bg-slate-800 text-white'
        };
        
        toast.classList.add(...colors[type].split(' '));
        toast.innerText = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('translate-y-20', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showAuthOverlay() {
        $('#view-auth').style.display = 'flex';
    }

    // 시스템 기동
    init();

})();
