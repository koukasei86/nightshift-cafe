export interface AppLifecycle {
  watch(onActive: (active: boolean) => void): () => void;
}

export const webLifecycle: AppLifecycle = {
  watch(onActive) {
    const update = () => onActive(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  },
};
