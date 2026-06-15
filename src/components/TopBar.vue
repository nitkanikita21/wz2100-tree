<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import SearchBox from './SearchBox.vue';
import { useSessionStore } from '../stores/session';
import { SUPPORTED_LOCALES, setLocale, type Locale } from '../i18n';

const { t, locale } = useI18n();
const session = useSessionStore();

const LOCALE_LABELS: Record<Locale, string> = { uk: 'Укр', en: 'Eng' };
</script>

<template>
  <header class="topbar">
    <h1 class="title">{{ t('app.title') }}</h1>
    <div class="search-slot">
      <SearchBox />
    </div>
    <div class="lang" role="group" aria-label="Language">
      <button
        v-for="l in SUPPORTED_LOCALES"
        :key="l"
        class="lang-btn"
        :class="{ active: locale === l }"
        @click="setLocale(l)"
      >
        {{ LOCALE_LABELS[l] }}
      </button>
    </div>
    <label class="game-toggle" :class="{ on: session.gameMode }">
      <input
        type="checkbox"
        :checked="session.gameMode"
        @change="session.toggleGameMode()"
      />
      <span>▶ {{ t('topbar.game') }}</span>
    </label>
  </header>
</template>

<style scoped>
.topbar {
  display: flex; align-items: center; gap: 16px;
  height: 100%; padding: 0 16px; box-sizing: border-box;
  background: var(--bg-panel); border-bottom: 1px solid var(--border);
}
.title {
  margin: 0; font-size: 15px; font-weight: 600;
  color: var(--text); white-space: nowrap;
}
.search-slot { flex: 1; display: flex; justify-content: center; }
.lang {
  display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
}
.lang-btn {
  padding: 4px 10px; border: none; background: transparent;
  color: var(--text-dim); cursor: pointer; font-size: 13px;
}
.lang-btn + .lang-btn { border-left: 1px solid var(--border); }
.lang-btn.active { background: var(--bg-node); color: var(--text); }
.game-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-dim); cursor: pointer; user-select: none; white-space: nowrap;
}
.game-toggle input { display: none; }
.game-toggle.on { border-color: var(--green); color: var(--green); }
</style>
