import { $createElement, $imageLoaded } from '../utils';
import { getMessage } from '../i18n';
import { settings } from '../settings';
import Toast from '../components/toast';
import ImageDB from '../api/imageDB';
import { normalizeBackgroundImageURL } from '../backgroundUrlValidation';
import { getBingImage } from '../api/bingImageDay';
import { containsPermissions } from '../api/permissions';
import {
  createBackdropFilter,
  createTileBackground,
  createToolbarBackground,
  cssColorToHex,
  getTileShadowOpacities,
  resolveToolbarOpacity
} from '../tileAppearance';
import { getBackgroundEntranceKeyframes } from '../backgroundEntrance';
import {
  getGridLayoutLimits,
  getHorizontalGapLimits,
  getTileSizeLimits
} from '../gridLayout';

export default {
  async setBG(pageRevealStarted = Promise.resolve()) {
    const bgEl = document.getElementById('bg');
    const bgState = settings.$.background_image;
    const doc = document.documentElement;

    bgEl.replaceChildren();
    bgEl.classList.remove('is-visible');
    document.body.classList.remove('has-color-background');
    doc.style.removeProperty('--body-background');

    if (bgState === 'background_color') {
      const themeBackground = window.getComputedStyle(doc).getPropertyValue('--theme-background');
      doc.style.setProperty(
        '--body-background',
        cssColorToHex(settings.$.background_color, cssColorToHex(themeBackground))
      );
      document.body.classList.add('has-color-background');
      return;
    }

    if (!['background_local', 'background_external', 'background_bing'].includes(bgState)) {
      return;
    }

    // Prepare background-dependent surface styles before the page is revealed.
    // The image or video itself can continue loading asynchronously.
    document.body.classList.add('has-image');

    const hideBackground = () => {
      document.body.classList.remove('has-image');
      bgEl.classList.remove('is-visible');
    };

    const showBackground = async() => {
      bgEl.classList.add('is-visible');
      await pageRevealStarted;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const keyframes = getBackgroundEntranceKeyframes(settings.$.background_entrance_effect);
      if (!keyframes || prefersReducedMotion) return;

      const animation = bgEl.animate(keyframes, {
        duration: settings.$.background_entrance_duration,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'both'
      });
      animation.finished
        .then(() => animation.cancel())
        .catch(() => undefined);
    };

    let resource;
    let hasVideo = false;
    if (bgState === 'background_local') {
      const image = await ImageDB.get('background');
      if (image?.blob) {
        resource = URL.createObjectURL(image.blob);
        hasVideo = image.blob.type.startsWith('video');
      }
    } else if (bgState === 'background_external') {
      const externalUrl = settings.$.background_external;
      resource = normalizeBackgroundImageURL(externalUrl);
      if (!resource && externalUrl) {
        await settings.updateKey('background_external', '');
        Toast.show(getMessage('notice_background_url_invalid'));
      }
    } else {
      const bingHostPermission = await containsPermissions({ origins: ['https://www.bing.com/*'] });
      if (!bingHostPermission) {
        hideBackground();
        return Toast.show({
          trustedHtml: getMessage('bing_permission_toast'),
          delay: 0
        });
      }
      const response = await getBingImage();
      resource = response?.imageurl;
    }

    if (!resource) {
      hideBackground();
      return;
    }

    if (hasVideo) {
      const video = $createElement('video', {
        src: resource
      });
      video.muted = true;
      video.loop = true;
      video.autoplay = true;

      bgEl.append(video);

      const canPlay = await new Promise(resolve => {
        video.addEventListener('canplay', () => resolve(true), { once: true });
        video.addEventListener('error', () => resolve(false), { once: true });
      });
      if (!canPlay) {
        hideBackground();
        return;
      }
      await showBackground();
    } else {
      let image;
      try {
        image = await $imageLoaded(resource);
      } catch (e) {
        console.warn(`Background image resource problem: ${e}`);
        if (bgState === 'background_local') {
          Toast.show(getMessage('notice_background_load_failed'));
          URL.revokeObjectURL(resource);
        }
      }
      if (!image) {
        if (bgState === 'background_external') {
          await settings.updateKey('background_external', '');
          Toast.show(getMessage('notice_background_url_load_failed'));
        }
        hideBackground();
        return;
      }

      bgEl.append(image);
      await showBackground();
    }
  },
  calculateStyles() {
    const doc = document.documentElement;
    const grid = document.getElementById('bookmarks');
    const columns = parseInt(settings.$.dial_columns);
    const lsGridWidth = parseInt(settings.$.dial_width);
    const clamp = (value, min, max, fallback) => {
      const number = parseInt(value);
      return Number.isFinite(number)
        ? Math.min(max, Math.max(min, number))
        : fallback;
    };
    const tileSize = clamp(settings.$.dial_tile_size, 50, 300, 100);
    const horizontalGap = clamp(settings.$.dial_horizontal_gap, 0, 160, 16);
    const verticalGap = clamp(settings.$.dial_vertical_gap, 0, 160, 16);
    const radius = clamp(settings.$.dial_radius, 0, 40, 18);
    const shadow = clamp(settings.$.dial_shadow, 0, 30, 8);
    const thumbnailSize = clamp(settings.$.favicon_size, 16, 128, 32);
    const titleSize = clamp(settings.$.bookmark_title_size, 10, 24, 14);
    const hoverLift = clamp(settings.$.dial_hover_lift, 0, 12, 4);
    const backgroundOpacity = clamp(settings.$.dial_background_opacity, 0, 100, 100);
    const toolbarOpacity = resolveToolbarOpacity({
      matchTileBackground: settings.$.toolbar_match_tile_background,
      tileOpacity: backgroundOpacity,
      toolbarOpacity: settings.$.toolbar_background_opacity
    });
    const shadowOpacities = getTileShadowOpacities(shadow, doc.classList.contains('dark'));
    const aspectRatios = new Set(['1 / 1', '4 / 3', '3 / 2', '16 / 9']);
    const aspectRatio = aspectRatios.has(settings.$.dial_aspect_ratio)
      ? settings.$.dial_aspect_ratio
      : '4 / 3';

    doc.style.setProperty('--grid-row-gap', `${verticalGap}px`);
    doc.style.setProperty('--bookmark-radius', `${radius}px`);
    doc.style.setProperty('--bookmark-aspect-ratio', aspectRatio);
    doc.style.setProperty('--bookmark-thumbnail-size', `${thumbnailSize}px`);
    doc.style.setProperty('--bookmark-title-size', `${titleSize}px`);
    doc.style.setProperty('--bookmark-shadow-opacity', `${shadowOpacities.resting}%`);
    doc.style.setProperty('--bookmark-hover-shadow-opacity', `${shadowOpacities.hover}%`);
    doc.style.setProperty('--bookmark-hover-lift', `${hoverLift}px`);
    const themeBackground = window.getComputedStyle(doc).getPropertyValue('--theme-background-2');
    const themeTextColor = window.getComputedStyle(doc).getPropertyValue('--theme-text-color');
    doc.style.setProperty('--bookmark-bg', createTileBackground(
      settings.$.dial_background_color,
      backgroundOpacity,
      themeBackground
    ));
    doc.style.setProperty(
      '--bookmark-backdrop-filter',
      createBackdropFilter(settings.$.dial_background_blur, backgroundOpacity)
    );
    doc.style.setProperty(
      '--toolbar-bg',
      createToolbarBackground({
        matchTileBackground: settings.$.toolbar_match_tile_background,
        tileColor: settings.$.dial_background_color,
        tileOpacity: backgroundOpacity,
        toolbarColor: settings.$.toolbar_background_color,
        toolbarOpacity: settings.$.toolbar_background_opacity,
        themeColor: themeBackground
      })
    );
    doc.style.setProperty(
      '--toolbar-backdrop-filter',
      createBackdropFilter(settings.$.toolbar_background_blur, toolbarOpacity)
    );
    doc.style.setProperty(
      '--bookmark-caption-color',
      settings.$.dial_title_color
        ? cssColorToHex(settings.$.dial_title_color, cssColorToHex(themeTextColor))
        : themeTextColor
    );

    const gridLayout = getGridLayoutLimits({
      columns,
      gridWidth: lsGridWidth,
      horizontalGap,
      tileSize,
      viewportWidth: doc.clientWidth
    });
    const mediaQuery = window.matchMedia('(width > 480px)');
    const containerWidth = mediaQuery.matches ? gridLayout.gridWidth : 100;
    doc.style.setProperty('--container-width', `${containerWidth}%`);

    // Reserve inline space only for controls at the right edge. The extension icon
    // floats above the page at the lower left and must not narrow the search or grid.
    if ((
      settings.$.show_settings_icon ||
      settings.$.show_quick_settings_icon ||
      settings.$.thumbnails_update_button
    ) && containerWidth >= 85
    ) {
      const circBtnSize = parseInt(window.getComputedStyle(doc).getPropertyValue('--circ-btn-size'));
      // button size + small padding
      // value = left right(increased padding for the scrollbar)
      // const paddingInline = `${circBtnSize + 20}px ${circBtnSize + 30}px`;
      doc.style.setProperty('--container-padding-inline', `${circBtnSize + 20}px`);
    } else {
      doc.style.removeProperty('--container-padding-inline');
    }

    const availableGridWidth = grid.clientWidth;
    const tileSizeLimits = getTileSizeLimits({
      columns,
      gridWidth: containerWidth,
      horizontalGap,
      viewportWidth: doc.clientWidth,
      availableWidth: availableGridWidth
    });
    const displayedTileSize = Math.min(
      tileSizeLimits.maximumTileSize,
      Math.max(tileSizeLimits.minimumTileSize, tileSize)
    );
    const horizontalGapLimits = getHorizontalGapLimits({
      columns,
      gridWidth: containerWidth,
      tileSize: displayedTileSize,
      viewportWidth: doc.clientWidth,
      availableWidth: availableGridWidth
    });
    const displayedHorizontalGap = Math.min(
      horizontalGapLimits.maximumHorizontalGap,
      Math.max(horizontalGapLimits.minimumHorizontalGap, horizontalGap)
    );
    doc.style.setProperty('--grid-column-gap', `${displayedHorizontalGap}px`);
    doc.style.setProperty('--grid-column-min-width', `${displayedTileSize}px`);

    doc.style.setProperty('--grid-column-width', `${displayedTileSize}px`);
    doc.style.setProperty('--grid-columns', columns);

    return {
      ...gridLayout,
      ...tileSizeLimits,
      ...horizontalGapLimits,
      horizontalGap: displayedHorizontalGap,
      tileSize: displayedTileSize
    };
  }
};
