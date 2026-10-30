window.__ModuleLoader__.load({
	id: "dsh-theme-promax",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/styles/base.css?skin-text
		var base_default = "/*\n * Skin stylesheet. Injected as one owned <style> element and removed with the\n * fiber.\n *\n * Two selector families live here:\n *   1. `.skin-*` classes and `--skin-*` variables — the skin's own markup.\n *   2. `[data-*]` hooks and `[class*='_name']` suffixes — the shell's markup.\n *      The build prefixes every CSS-module class with a per-build hash\n *      (`atLKnG_composerStack`), so the readable suffix is the stable part and\n *      the hash never appears here. Every rule in family 2 is scoped under\n *      `[data-conversation-content][data-content-phase='hero']`, so it can only\n *      ever reach the blank-session composer.\n *\n * Reference geometry (CSS px at 1302x740) is recorded next to each value.\n */\n\n:root {\n  --skin-sidebar-width: 240.5px;\n  --skin-sidebar-bg: #FBFBFB;\n  --skin-main-bg: #FFFFFF;\n  --skin-text: #0D0D0D;\n  --skin-text-muted: #777777;\n  --skin-border: #F0F0F0;\n  --skin-tile: #FFFFFF;\n  --skin-tile-size: 110px;\n  --skin-tile-radius: 28px;\n  --skin-mark: #515151;\n  --skin-chip-h: 34px;\n  --skin-chip-radius: 10px;\n  --skin-chip-gap: 8.5px;\n\n  /* Vertical anchors, all measured off the reference screenshot. */\n  --skin-hero-top: 213.75px; /* brand tile top */\n  --skin-hero-title-gap: 38.55px; /* tile bottom → headline box top */\n  --skin-hero-chips-gap: 32.3px; /* headline box bottom → chips top */\n  --skin-composer-card-width: 735px; /* card outer width */\n  --skin-composer-tray-width: 708px; /* tray outer width, 13.5 inside the card */\n  --skin-composer-tray-h: 56px;\n  --skin-composer-overlap: 18px; /* card rides over the tray's lower edge */\n  --skin-composer-floor: 17.5px; /* card bottom → viewport bottom */\n}\n\n/* ---- blank-session hero ------------------------------------------------- */\n.skin-hero {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  text-align: center;\n  gap: 0;\n}\n\n.skin-hero__tile {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: var(--skin-tile-size);\n  height: var(--skin-tile-size);\n  border-radius: var(--skin-tile-radius);\n  background: var(--skin-tile);\n  color: var(--skin-mark);\n  /* The reference tile is white on white: only a symmetric ambient shadow\n     separates it, ~10px of spread on every side. */\n  box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);\n}\n\n.skin-logo {\n  display: block;\n}\n\n.skin-hero__title {\n  margin-top: var(--skin-hero-title-gap);\n  /* The reference headline's ink sits 6.25px left of the column centre (its\n     own layout reserves a trailing element the screenshot does not show). A\n     12.5px trailing inset reproduces that offset without moving the ink's\n     vertical position. */\n  margin-right: 12.5px;\n  font-size: 26.7px;\n  line-height: 1.2;\n  /* Weight by ink, not by intent: over the same ink box the reference carries\n     4975 dark pixels, while 600 renders 6658, 500 renders 6029 and 400 renders\n     4738. The reference face is a different family whose regular is a shade\n     heavier than the shipped stack's, so 400 is the closest match available. */\n  font-weight: 400;\n  letter-spacing: -0.2px;\n  color: var(--skin-text);\n}\n\n.skin-hero__chips {\n  display: flex;\n  align-items: center;\n  gap: var(--skin-chip-gap);\n  margin-top: var(--skin-hero-chips-gap);\n}\n\n.skin-hero__chip {\n  box-sizing: border-box;\n  height: var(--skin-chip-h);\n  padding: 0 9.75px;\n  border: 1px solid var(--skin-border);\n  border-radius: var(--skin-chip-radius);\n  background: #FFFFFF;\n  color: var(--skin-text-muted);\n  font-size: 12px;\n  line-height: 32px;\n  font-family: inherit;\n  cursor: pointer;\n  transition: background-color 120ms ease, border-color 120ms ease;\n}\n\n.skin-hero__chip:hover {\n  background: #F7F7F7;\n  border-color: #E6E6E6;\n}\n\n/* ---- blank-session shell layout ---------------------------------------- */\n\n/* The shipped hero phase centres the whole stack (hero + tray + card) in the\n   scroll body. The reference splits it: the hero block is anchored near the top\n   and the composer is docked to the floor. Re-anchoring is a layout change, so\n   every rule below is scoped to the hero phase and unwinds with the fiber. */\n\n/* The blank-session header is 40px of in-flow chrome above the body, which\n   would push every anchor below it down by that much. The reference keeps the\n   header's top-right controls but lets the body start at the window's top edge,\n   so the header becomes an overlay: same controls, no band.\n\n   `z-index` is load-bearing, not decoration: a positioned element with\n   `z-index: auto` paints in DOM order, and the conversation body (a later\n   sibling, `position: relative`) therefore painted *over* the overlay and ate\n   the clicks aimed at the right-panel toggle at the top right. One step above\n   the body's auto is enough; menus and modals live in portals on <body>. */\n[class*='_root']:has(> [data-conversation-content][data-content-phase='hero'])\n  header[data-window-drag] {\n  position: absolute;\n  inset: 0 0 auto;\n  z-index: 1;\n  min-height: 0;\n  border-bottom: none;\n  background: transparent;\n}\n\n[data-conversation-content][data-content-phase='hero'] [data-conversation-scroll] {\n  justify-content: flex-start;\n  /* The 2px edge offset and the reserved gutter both shift the composer's\n     centre off the reference's; the hero phase has nothing to scroll. */\n  margin-right: 0;\n  scrollbar-gutter: auto;\n}\n\n/* Let the seat take the whole column so its children can be split top/bottom. */\n[data-conversation-content][data-content-phase='hero']\n  [data-conversation-scroll] > [data-composer-seat] {\n  flex: 1;\n  min-height: 0;\n}\n\n[data-conversation-content][data-content-phase='hero'] [class*='_composerStack'] {\n  flex: 1;\n  min-height: 0;\n  gap: 0;\n  padding-bottom: var(--skin-composer-floor);\n  --dsh-composer-card-max-width: var(--skin-composer-card-width);\n}\n\n/* HeroShell's own root: stop filling the column and shrink-wrap instead, so the\n   tray and card can be pushed to the floor by the auto margin below. */\n[data-conversation-content][data-content-phase='hero']\n  [class*='_composerStack'] > :first-child {\n  flex: none;\n  height: auto;\n  padding: var(--skin-hero-top) 24px 0;\n  margin-bottom: auto;\n}\n\n/* Workspace tray: a filled pill the card overlaps, not a bare control row.\n   It sits in the stack (card + two side clearances), so its inset is the\n   clearance plus half the width difference to the card. */\n[data-conversation-content][data-content-phase='hero'] [class*='_heroWorkspaceRow'] {\n  box-sizing: border-box;\n  height: var(--skin-composer-tray-h);\n  margin: 0 calc(\n    var(--dsh-composer-side-clearance)\n    + (var(--skin-composer-card-width) - var(--skin-composer-tray-width)) / 2\n  );\n  /* The card covers the tray's lower edge, so the label centres in the visible\n     38px band rather than the full 56px pill. */\n  padding: 0 14px var(--skin-composer-overlap);\n  border-radius: 16px;\n  background: #F3F3F3;\n}\n\n/* Pull the card up under the tray's lower edge. The slot renderer wraps the bar\n   in a `display: contents` div, which generates no box and therefore ignores\n   margins, so the offset has to land on the bar's own root. */\n[data-conversation-content][data-content-phase='hero']\n  [class*='_composerStack'] [class*='_root'][class*='_hero'] {\n  margin-top: calc(-1 * var(--skin-composer-overlap));\n}\n\n/* The hero card is one text line tall in the reference, so it takes a shorter\n   floor than the shipped two-line hero floor, and its send circle is 28. */\n[data-conversation-content][data-content-phase='hero']\n  [class*='_root'][class*='_hero'] [class*='_input'] {\n  min-height: 34.5px;\n}\n\n[data-conversation-content][data-content-phase='hero']\n  [data-composer-card] [class*='_primary'] {\n  width: 28px;\n  height: 28px;\n}\n\n/* Empty composer: the reference's send circle is a neutral grey disc with a\n   grey arrow, not the shipped disabled-blue at 40% opacity. */\n[data-conversation-content][data-content-phase='hero']\n  [data-composer-card] [class*='_primary']:disabled {\n  background: #F1F1F1;\n  color: #777777;\n  opacity: 1;\n}\n\n/* ---- sidebar control radius -------------------------------------------- */\n\n/* The shipped column rounds its controls with two shared tokens: 8px on the\n   icon buttons (collapse, search, view options, add workspace) and 12px on the\n   New Session bar, the panel entries and every session/workspace row. The skin\n   flattens both to one radius so a button, a panel entry and a session title\n   all carry the same corner — the value below is the single knob for it.\n\n   The override is a custom property declared on the column itself rather than\n   a list of class suffixes, because the rows are not the sidebar's own markup:\n   ui-workspace renders the workspace and session lists into this column. An\n   inherited token reaches them without naming a single hashed class, and it\n   stops at the column boundary, so the composer, the menus that portal to\n   <body> and the right-hand panel keep their shipped rounding. */\n[class*='_sidebarCol'] {\n  --dsw-radius-sm: 16px;\n  --dsw-radius-md: 16px;\n}\n\n/* ---- sidebar column ---------------------------------------------------- */\n\n/* The macOS column is a translucent tint plus a blue wash top and a\n   blue-violet one bottom, written to let the window's vibrancy show through.\n   Over anything but a real vibrancy layer the three composite to a cool grey\n   (#EEF2FB at the top, #F1F1F7 at the bottom); the reference column is the flat\n   #FBFBFB an opaque design would use, so the skin paints it flat. The\n   `html[data-platform]` prefix is load-bearing: the shipped rule is a\n   four-compound darwin selector, so a bare attribute selector would lose. */\nhtml[data-platform] [class*='_frame']:not([data-sidebar-drawer]) [class*='_sidebarCol'] {\n  background: #FBFBFB;\n}\n\n/* The separator belongs to the centre column on darwin; the reference draws it\n   #EDEDED, one step lighter than the shipped l3 hairline. */\nhtml[data-platform] [class*='_centerCol'] {\n  border-left-color: #EDEDED;\n}\n\n";
		//#endregion
		//#region src/client/theme.ts
		/**
		* Skin tokens. Everything here is an alias-token override folded into the
		* active theme snapshot by ui-theme, so the palette keeps working in both
		* schemes and the skin never patches a component's stylesheet.
		*
		* Values are measured from `reference/screenshot.png` (2604x1480 at DPR 2):
		* the sidebar edge sits at x=483, the hero tile at 1465..1620 / 465..609, the
		* suggestion chips at 854..921, the workspace tray at 807..2278 / 1188..1297.
		*/
		const SKIN_TOKENS = {
			"--dsw-alias-bg-base": {
				light: "#FFFFFF",
				dark: "#141414"
			},
			"--dsw-alias-bg-layer-1": {
				light: "#FFFFFF",
				dark: "#1C1C1C"
			},
			"--dsw-alias-bg-layer-2": {
				light: "#FFFFFF",
				dark: "#232323"
			},
			"--dsw-alias-bg-layer-3": {
				light: "#F3F3F3",
				dark: "#2A2A2A"
			},
			"--dsw-alias-bg-module-platform": {
				light: "#F3F3F3",
				dark: "#2A2A2A"
			},
			"--dsw-alias-label-primary": {
				light: "#0D0D0D",
				dark: "#F5F5F5"
			},
			"--dsw-alias-label-secondary": {
				light: "#5F5F5A",
				dark: "#A3A3A0"
			},
			"--dsw-alias-label-tertiary": {
				light: "#8A8A85",
				dark: "#7A7A76"
			},
			"--dsw-alias-border-l1": {
				light: "#EFEFEF",
				dark: "#2E2E2E"
			},
			"--dsw-alias-border-l2": {
				light: "#EBEBEB",
				dark: "#333333"
			},
			"--dsw-alias-border-l3": {
				light: "#E3E3E3",
				dark: "#3A3A3A"
			},
			"--dsw-alias-border-l4": {
				light: "#D8D8D8",
				dark: "#444444"
			},
			"--dsw-radius-sm": {
				light: "8px",
				dark: "8px"
			},
			"--dsw-radius-md": {
				light: "12px",
				dark: "12px"
			},
			"--dsw-radius-lg": {
				light: "16px",
				dark: "16px"
			},
			"--dsw-radius-xl": {
				light: "24px",
				dark: "24px"
			},
			"--dsw-radius-panel": {
				light: "28px",
				dark: "28px"
			},
			"--dsw-shadow-lv1": {
				light: "0 2px 4px 0 rgba(0,0,0,0.04)",
				dark: "0 2px 4px 0 rgba(0,0,0,0.4)"
			},
			"--dsw-shadow-lv2": {
				light: "0 8px 24px 0 rgba(0,0,0,0.06), 0 2px 8px 0 rgba(0,0,0,0.04)",
				dark: "0 8px 24px 0 rgba(0,0,0,0.5), 0 2px 8px 0 rgba(0,0,0,0.4)"
			},
			"--dsw-shadow-lv3": {
				light: "0 18px 48px 0 rgba(0,0,0,0.08), 0 4px 12px 0 rgba(0,0,0,0.04)",
				dark: "0 18px 48px 0 rgba(0,0,0,0.6), 0 4px 12px 0 rgba(0,0,0,0.4)"
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/** Copy owned by the skin's own locale namespace (`theme.promax`). */
		const zh = {
			"hero.title": "你想构建什么?",
			"hero.chip.intro": "介绍这个项目",
			"hero.chip.fix": "查找需要修复的问题",
			"hero.chip.summary": "总结最近的改动",
			"hero.prompt.intro": "介绍这个项目",
			"hero.prompt.fix": "查找需要修复的问题",
			"hero.prompt.summary": "总结最近的改动"
		};
		const en = {
			"hero.title": "What do you want to build?",
			"hero.chip.intro": "Introduce this project",
			"hero.chip.fix": "Find issues to fix",
			"hero.chip.summary": "Summarize recent changes",
			"hero.prompt.intro": "Introduce this project",
			"hero.prompt.fix": "Find issues to fix",
			"hero.prompt.summary": "Summarize recent changes"
		};
		const NS = "theme.promax";
		//#endregion
		//#region src/client/hero/mark-data.ts
		/**
		* Generated by scripts/make-mark.mjs — do not edit.
		*
		* The reference brand mark at capture resolution (156x145, DPR 2),
		* alpha-masked so it composites on the tile's own fill. Rendered at
		* 78x72.5 CSS px.
		*/
		const MARK_DATA_URI = "data:image/png;base64,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";
		//#endregion
		//#region src/client/hero/LogoMark.tsx
		/**
		* The reference brand mark, drawn at its captured size.
		*
		* A hand-drawn three-loop knot cannot be rebuilt from ellipses — rows through
		* the reference are not consistent with any one ellipse construction — so the
		* mark ships as the reference's own alpha-masked pixels (`scripts/make-mark.mjs`)
		* and keeps its exact optical weight at the reference viewport. 78x72.5 CSS px
		* is the measured ink box inside the 110px tile.
		*/
		function LogoMark() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: "skin-logo",
				src: MARK_DATA_URI,
				width: 78,
				height: 72.5,
				alt: "",
				"aria-hidden": "true",
				draggable: false
			});
		}
		//#endregion
		//#region src/client/hero/HeroContent.tsx
		/** One suggestion chip: a label and the draft it stages. */
		const CHIPS = [
			{
				label: "hero.chip.intro",
				prompt: "hero.prompt.intro"
			},
			{
				label: "hero.chip.fix",
				prompt: "hero.prompt.fix"
			},
			{
				label: "hero.chip.summary",
				prompt: "hero.prompt.summary"
			}
		];
		/**
		* Occupant of `conversation.hero.content`: the blank-session stack of the
		* reference screen — 110px brand tile, 26px headline, one row of suggestion
		* chips. Chips stage a draft through the resident input actions, so clicking
		* one behaves like typing into the composer.
		*/
		function HeroContent({ t, inputActions }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "skin-hero",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "skin-hero__tile",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LogoMark, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "skin-hero__title",
						children: t("hero.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "skin-hero__chips",
						children: CHIPS.map((chip) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "skin-hero__chip",
							onClick: () => {
								inputActions?.setDraft(t(chip.prompt));
							},
							children: t(chip.label)
						}, chip.label))
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Services this browser half needs before it can contribute UI. */
		const inject = [
			"slots",
			"theme",
			"locale",
			"layout"
		];
		/** Sidebar track width of the reference screen, in CSS pixels. */
		const SIDEBAR_WIDTH = 240.5;
		/**
		* Read one optional host capability, warning instead of throwing.
		*
		* The client boot treats a single failed entry as fatal for the whole window
		* (`web boot: 1 entry did not activate`), so a presentation plugin that calls
		* an API its host does not ship takes the entire app down with it — which is
		* exactly what happened against a 0.2.1-rc.5 desktop build, where `ui-layout`
		* has no `setSidebarWidth`. Every capability the skin cannot prove at author
		* time is therefore probed: the host that lacks one keeps booting, the skin
		* degrades to what it can still express, and the console names the missing
		* piece and what it was for.
		*
		* @param target - host object that may or may not carry the capability.
		* @param key - capability name.
		* @param reason - what the skin needs it for, printed with the warning.
		* @returns the capability, or `undefined` when this host does not ship it.
		*/
		function capability(target, key, reason) {
			const value = target?.[key];
			if (value === void 0) console.warn(`[dsh-theme-promax] 宿主未提供 ${key}（${reason}）。皮肤已降级，应用启动不受影响。`);
			return value;
		}
		/**
		* Mount the skin: one owned stylesheet, one token-override layer, and the
		* seats that replace shipped presentation. Every registration is an effect, so
		* disabling the bundle unwinds the skin without touching the host packages.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const tag = document.createElement("style");
				tag.dataset.plugin = "dsh-theme-promax";
				tag.textContent = base_default;
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, "skin: stylesheet");
			ctx.effect(() => ctx.theme.overrideTokens("dsh-theme-promax", SKIN_TOKENS), "skin: alias tokens");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "skin: dictionaries");
			ctx.effect(() => {
				const layout = ctx.layout;
				capability(layout, "setSidebarWidth", "侧栏宽度由 ui-layout 写入")?.call(layout, SIDEBAR_WIDTH);
			}, "skin: sidebar track");
			ctx.effect(() => ctx.slots.inject("conversation.hero.content", () => ctx.slots.register({
				name: "conversation.hero.content",
				locale: NS
			}, HeroContent)), "skin: hero stack");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
