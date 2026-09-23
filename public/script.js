const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');

const syncHeader = () => header?.classList.toggle('scrolled', window.scrollY > 16);
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menu?.classList.toggle('open', open);
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menu?.classList.remove('open');
  });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('visible'));
} else {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

  revealItems.forEach((item) => observer.observe(item));
}

document.querySelectorAll('[data-year]').forEach((item) => {
  item.textContent = new Date().getFullYear();
});

// Native video remains usable without JavaScript. Only explicit user actions
// start playback. Both languages use the same direct video.src/load path.
let video = document.querySelector('#product-video');
const languageButtons = [...document.querySelectorAll('[data-language]')];
const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
const demoStatus = document.querySelector('[data-demo-status]');
const mediaRoot = '/assets/demo-v4';
const imageRoot = '/assets/tour-v1';
const demoLanguages = {
  en: { name: 'English', chapters: { catalog: 22.233, admin: 64.2, access: 89.667, connect: 136.967 } },
  it: { name: 'Italiano', chapters: { catalog: 25.967, admin: 72.633, access: 103.8, connect: 156.733 } },
};
let demoLanguage = 'en';
let pendingChapter = null;

const timestamp = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const clearActiveChapter = () => chapterButtons.forEach((button) => button.removeAttribute('aria-current'));

if (video) {
  document.querySelectorAll('[data-demo-controls]').forEach((element) => { element.hidden = false; });
  let captionsEnabled = false;
  let recoveredInitialError = false;
  const showVideoError = (message) => {
    demoStatus.textContent = message;
    demoStatus.classList.add('demo-status-error');
  };
  const clearVideoError = () => demoStatus.classList.remove('demo-status-error');
  const attachCaptions = () => {
    if (video.querySelector('track')) return;
    // Safari successfully starts the same MP4 in the minimal diagnostic player.
    // Add captions only once media is playing, not during its initial load.
    const track = document.createElement('track');
    track.kind = 'captions';
    track.src = `${mediaRoot}/${demoLanguage}/captions.vtt`;
    track.srclang = demoLanguage;
    track.label = demoLanguages[demoLanguage].name;
    video.append(track);
    if (captionsEnabled) track.track.mode = 'showing';
  };
  const bindVideo = () => {
    const current = video;
    current.addEventListener('loadedmetadata', () => {
      if (current === video && pendingChapter !== null) seekToChapter(pendingChapter);
    });
    current.addEventListener('playing', () => {
      if (current !== video) return;
      clearVideoError();
      attachCaptions();
    });
    current.addEventListener('timeupdate', () => {
      if (current !== video) return;
      const active = [...chapterButtons].reverse().find((button) =>
        video.currentTime >= demoLanguages[demoLanguage].chapters[button.dataset.chapter]);
      chapterButtons.forEach((button) => {
        if (button === active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    });
    current.addEventListener('error', () => {
      if (current !== video) return;
      if (!recoveredInitialError) {
        // A fresh element on a tap works on the affected iPhone. Also clear a
        // failed initial preload so Safari's native Play can be tried again.
        recoveredInitialError = true;
        replacePlayer();
        return;
      }
      pendingChapter = null;
      showVideoError('The video could not load. Tap English to retry, or use the EN video link below.');
    });
  };
  const replacePlayer = () => {
    const previous = video;
    const previousTrack = previous.querySelector('track');
    if (previousTrack) captionsEnabled = previousTrack.track.mode === 'showing';
    const next = previous.cloneNode(false);
    next.removeAttribute('src');
    next.preload = 'none';
    next.setAttribute('aria-label', `Frontdoor product demo — ${demoLanguages[demoLanguage].name}`);
    previous.replaceWith(next);
    video = next;
    bindVideo();
    previous.pause();
    previous.removeAttribute('src');
    previous.load();
    video.src = `${mediaRoot}/${demoLanguage}/frontdoor-demo.mp4`;
    video.load();
  };
  const playVideo = () => {
    const current = video;
    current.play().catch(() => {
      if (current !== video) return;
      showVideoError('The video did not start. Tap the selected language to retry, or use the video link below.');
    });
  };
  const seekToChapter = (seconds) => {
    video.currentTime = seconds;
    pendingChapter = null;
  };
  bindVideo();
  if (video.error) {
    recoveredInitialError = true;
    replacePlayer();
  }

  languageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const language = button.dataset.language;
      if (!demoLanguages[language]) return;
      if (language === demoLanguage) {
        // Match the proven Safari diagnostic: recreate failed/uninitialized
        // media synchronously inside the user's tap before calling play().
        if (video.error || video.readyState === 0) replacePlayer();
        clearVideoError();
        playVideo();
        return;
      }
      recoveredInitialError = false;
      pendingChapter = null;
      demoLanguage = language;
      replacePlayer();
      clearVideoError();
      clearActiveChapter();
      languageButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      chapterButtons.forEach((item) => {
        item.querySelector('time').textContent = timestamp(demoLanguages[language].chapters[item.dataset.chapter]);
      });
      const transcript = document.querySelector('[data-transcript]');
      transcript.href = `${imageRoot}/${language}/transcript.html?v=2`;
      transcript.textContent = language === 'it' ? 'Leggi la trascrizione ↗' : 'Read the transcript ↗';
      transcript.lang = language;
      demoStatus.textContent = `${demoLanguages[language].name} selected.`;
      playVideo();
    });
  });

  chapterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const seconds = demoLanguages[demoLanguage].chapters[button.dataset.chapter];
      if (video.readyState >= 1) {
        seekToChapter(seconds);
      } else {
        pendingChapter = seconds;
        if (video.error || video.readyState === 0) replacePlayer();
      }
      playVideo();
      demoStatus.textContent = `Opening chapter at ${timestamp(seconds)}.`;
    });
  });

}

const screenButtons = [...document.querySelectorAll('[data-screen]')];
const tourPanels = [...document.querySelectorAll('[data-tour-panel]')];
const tourStatus = document.querySelector('[data-tour-status]');
const imageLanguageButtons = [...document.querySelectorAll('[data-image-language]')];
let imageLanguage = 'en';

if (screenButtons.length && tourPanels.length) {
  document.querySelector('.tour-layout').classList.add('is-interactive');
  document.querySelectorAll('[data-tour-controls]').forEach((element) => { element.hidden = false; });
  const showScreen = (name, announce = true) => {
    tourPanels.forEach((panel) => { panel.hidden = panel.dataset.tourPanel !== name; });
    screenButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.screen === name)));
    const active = tourPanels.find((panel) => panel.dataset.tourPanel === name);
    if (announce) tourStatus.textContent = `${active.querySelector('h3').textContent} ${imageLanguage.toUpperCase()} screenshot.`;
  };
  screenButtons.forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screen)));
  imageLanguageButtons.forEach((button) => button.addEventListener('click', () => {
    const language = button.dataset.imageLanguage;
    if (!demoLanguages[language] || language === imageLanguage) return;
    imageLanguage = language;
    tourPanels.forEach((panel) => {
      const img = panel.querySelector('[data-asset]');
      const url = `${img.dataset.assetRoot || imageRoot}/${language}/${img.dataset.asset}.webp`;
      img.src = url;
      panel.querySelectorAll('[data-full-image]').forEach((link) => { link.href = url; });
    });
    imageLanguageButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    tourStatus.textContent = `${demoLanguages[language].name} screenshots selected.`;
  }));
  showScreen('catalog', false);
}
