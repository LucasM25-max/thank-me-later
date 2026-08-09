(() => {
  let menu = null;
  let pendingCommand = null;
  let selectedConnector = null;
  const COMMAND_MARKER = '\u2063[TML_COMMAND]\u2063';

  const getComposer = () => document.querySelector('.composer');
  const getTextarea = () => document.querySelector('.composer textarea') || document.querySelector('textarea');
  const getModel = () => document.querySelector('.model > button')?.textContent?.trim() || '';
  const isGPT = () => /GPT-5\.6 Luna/i.test(getModel());

  function closeMenu() { menu?.remove(); menu = null; }
  function setReactTextarea(value) {
    const textarea = getTextarea(); if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.focus();
  }
  function addPill(label) {
    const pending = document.querySelector('.pending'); if (!pending) return;
    pending.querySelectorAll('.tml-command-pill').forEach(p => p.remove());
    const pill = document.createElement('span'); pill.className = 'tml-command-pill'; pill.textContent = label; pending.prepend(pill);
  }
  function selectCommand(kind) {
    const textarea = getTextarea(); if (!textarea) return;
    const current = textarea.value.replace(/\/$/, '').replace(/^\u2063\[TML_COMMAND\]\u2063\s*/, '').trimStart();
    pendingCommand = kind; setReactTextarea(`${COMMAND_MARKER}${current ? ` ${current}` : ''}`);
    addPill(kind === 'code' ? 'Code' : kind === 'web' ? 'Web search' : kind === 'image' ? 'Create image' : 'Deep research'); closeMenu();
  }
  function makeMenu() {
    closeMenu(); const composer = getComposer(); if (!composer) return;
    menu = document.createElement('div'); menu.id = 'tml-command-menu'; menu.className = 'command-menu';
    const items = []; if (isGPT()) items.push(['web','Web search','Search the web for current information']); if (isGPT()) items.push(['image','Create image','Create an image from your prompt']); if (isGPT()) items.push(['research','Deep research','Carry out deeper research on the request']); items.push(['code','Code','Use the dedicated coding system prompt']);
    items.forEach(([kind,label,description]) => { const button=document.createElement('button'); button.type='button'; button.innerHTML=`<strong>${label}</strong><span>${description}</span>`; button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectCommand(kind)}); menu.appendChild(button); });
    composer.appendChild(menu);
  }
  function githubLogo() { const img=document.createElement('img'); img.className='tml-github-logo'; img.alt=''; img.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'; return img; }

  /* Keep the connector pill physically inside the composer, immediately before the text input. */
  function connectorPill() {
    const composer = getComposer(); if (!composer) return;
    composer.querySelectorAll('.tml-connector-inline,.tml-connector-pill').forEach(p => p.remove());
    if (!selectedConnector) return;
    const pill = document.createElement('span'); pill.className='tml-connector-inline';
    pill.appendChild(githubLogo()); const label=document.createElement('span'); label.textContent=selectedConnector; pill.appendChild(label);
    const remove=document.createElement('button'); remove.type='button'; remove.setAttribute('aria-label','Remove GitHub connector'); remove.textContent='×';
    remove.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectedConnector=null;connectorPill();}); pill.appendChild(remove);
    const textarea=getTextarea();
    if (textarea) composer.insertBefore(pill, textarea); else composer.appendChild(pill);
  }
  function closeConnectorMenu() { document.querySelector('#tml-connector-menu')?.remove(); }
  function openConnectorMenu() {
    closeConnectorMenu(); const composer=getComposer(); if(!composer||!isGPT())return;
    const menu=document.createElement('div'); menu.id='tml-connector-menu'; menu.className='tml-connector-menu';
    const title=document.createElement('div'); title.className='tml-connector-title'; title.textContent='Connectors'; menu.appendChild(title);
    const github=document.createElement('button'); github.type='button'; github.className='tml-connector-option'; github.appendChild(githubLogo());
    const copy=document.createElement('span'); const name=document.createElement('strong'); name.textContent='GitHub'; const description=document.createElement('small'); description.textContent='Connect GitHub to this prompt'; copy.append(name,description); github.appendChild(copy);
    github.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectedConnector='GitHub';connectorPill();closeConnectorMenu();getTextarea()?.focus();}); menu.appendChild(github); composer.appendChild(menu);
  }
  function ensureConnectorButton() {
    const composer=getComposer(); if(!composer)return;
    const fileLabel=composer.querySelector('label[title="Attach files"], label[title*="Attach"], label');
    let button=composer.querySelector('.tml-connector-button');
    if(!isGPT()){button?.remove();closeConnectorMenu();if(selectedConnector){selectedConnector=null;connectorPill()}return;}
    if(!button){
      button=document.createElement('button'); button.type='button'; button.className='tml-connector-button'; button.title='Connectors'; button.setAttribute('aria-label','Connectors'); button.textContent='+';
      button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openConnectorMenu();});
      if(fileLabel) fileLabel.insertAdjacentElement('afterend',button);
      else { const textarea=getTextarea(); if(textarea) textarea.insertAdjacentElement('beforebegin',button); else composer.appendChild(button); }
    }
    connectorPill();
  }
  function bind() {
    const textarea=getTextarea();
    if(textarea&&!textarea.dataset.tmlBound){textarea.dataset.tmlBound='1';textarea.addEventListener('input',()=>{if(textarea.value.endsWith('/'))makeMenu();else if(!textarea.value.includes(COMMAND_MARKER))closeMenu()},true);textarea.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeConnectorMenu()}},true)}
    ensureConnectorButton(); if(!document.body.dataset.tmlFetchPatched)patchFetch();
  }
  function patchFetch(){
    const original=window.fetch; window.fetch=async function(input,init){try{const url=typeof input==='string'?input:input?.url||'';if(url.endsWith('/api/chat')&&init?.body){const body=JSON.parse(init.body);body.mode='chat';
      if(selectedConnector&&/gpt-5\.6-luna/i.test(String(body.model||''))){body.messages=Array.isArray(body.messages)?body.messages.map((m,i)=>{if(i!==body.messages.length-1||m.role!=='user')return m;const content=String(m.content||'').replace(/^\s*/,'');if(/^@GitHub\b/i.test(content))return m;return{...m,content:`@${selectedConnector}${content?` ${content}`:''}`}}):body.messages;selectedConnector=null;connectorPill()}
      if(pendingCommand){const command=pendingCommand;const prefix=command==='web'?'@Web search':command==='image'?'@Create image':command==='research'?'@Deep research':'';body.messages=Array.isArray(body.messages)?body.messages.map((m,i)=>{if(i!==body.messages.length-1)return m;let content=String(m.content||'').replace(COMMAND_MARKER,'').trim();if(prefix){if(/^@GitHub\b/i.test(content)){content=content.replace(/^@GitHub\b\s*/i,'');content=`@GitHub ${prefix}${content?` ${content}`:''}`}else content=`${prefix}${content?` ${content}`:''}`}return{...m,content}}):body.messages;body.codeCommand=command==='code';pendingCommand=null}
      init={...init,body:JSON.stringify(body)}}}catch{}return original.call(this,input,init)};document.body.dataset.tmlFetchPatched='1';
  }
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true}); setInterval(bind,700); bind();
})();
