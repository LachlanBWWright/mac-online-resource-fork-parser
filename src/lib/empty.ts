// Empty module to replace fs/promises in browser builds
export const readFile = () => {
  throw new Error('fs/promises not available in browser');
};
