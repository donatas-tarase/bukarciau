import { initialContent, assets } from './generated.mjs';
import { parseContent, getImageReferences } from '../shared/content.mjs';
import { renderPage, renderRobots, renderSitemap, renderTheme } from '../shared/render.mjs';
import { createHandler } from './app.mjs';

export const handleRequest = createHandler({ initialContent, assets, parseContent, getImageReferences, renderPage, renderRobots, renderSitemap, renderTheme });

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};
