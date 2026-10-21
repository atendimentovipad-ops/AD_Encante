import {defineConfig} from 'vitest/config';
export default defineConfig({resolve:{alias:{'@':new URL('./src',import.meta.url).pathname}},test:{include:['src/test/blip.test.ts','src/test/quarter.test.ts','src/test/uf.test.ts','src/test/ddd.test.ts']}});
