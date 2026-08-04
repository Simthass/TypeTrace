import { expect, type Page } from "@playwright/test";

interface AccessibilityIssue {
  rule: string;
  selector: string;
  message: string;
}

interface AccessibilityOptions {
  requireMain?: boolean;
  requireSkipLink?: boolean;
}

export async function expectBaselineAccessibility(
  page: Page,
  options: AccessibilityOptions = {},
): Promise<void> {
  const requireMain = options.requireMain ?? true;
  const requireSkipLink = options.requireSkipLink ?? true;

  const issues = await page.evaluate(
    ({ shouldRequireMain, shouldRequireSkipLink }) => {
      const findings: AccessibilityIssue[] = [];

      const isVisible = (element: Element): element is HTMLElement => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const selectorFor = (element: Element): string => {
        if (element.id) return `#${CSS.escape(element.id)}`;

        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.body && parts.length < 4) {
          let part = current.tagName.toLowerCase();
          const parent = current.parentElement;

          if (parent) {
            const siblings = Array.from(parent.children).filter(
              (candidate) => candidate.tagName === current?.tagName,
            );
            if (siblings.length > 1) {
              part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
          }

          parts.unshift(part);
          current = parent;
        }

        return parts.join(" > ");
      };

      const textFromIds = (value: string | null): string =>
        String(value || "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent?.trim() || "")
          .filter(Boolean)
          .join(" ")
          .trim();

      const accessibleName = (element: HTMLElement): string => {
        const ariaLabel = element.getAttribute("aria-label")?.trim();
        if (ariaLabel) return ariaLabel;

        const labelledBy = textFromIds(element.getAttribute("aria-labelledby"));
        if (labelledBy) return labelledBy;

        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        ) {
          const labels = Array.from(element.labels || [])
            .map((label) => label.textContent?.trim() || "")
            .filter(Boolean)
            .join(" ")
            .trim();
          if (labels) return labels;

          if (
            element instanceof HTMLInputElement &&
            ["button", "submit", "reset"].includes(element.type) &&
            element.value.trim()
          ) {
            return element.value.trim();
          }
        }

        if (element instanceof HTMLImageElement) {
          return element.alt.trim();
        }

        const text = element.textContent?.replace(/\s+/g, " ").trim();
        if (text) return text;

        const descendantImageText = Array.from(
          element.querySelectorAll<HTMLImageElement>("img[alt]"),
        )
          .map((image) => image.alt.trim())
          .filter(Boolean)
          .join(" ")
          .trim();
        if (descendantImageText) return descendantImageText;

        return element.getAttribute("title")?.trim() || "";
      };

      const ids = new Map<string, Element[]>();
      document.querySelectorAll<HTMLElement>("[id]").forEach((element) => {
        const id = element.id.trim();
        if (!id) return;
        const existing = ids.get(id) || [];
        existing.push(element);
        ids.set(id, existing);
      });

      ids.forEach((elements, id) => {
        if (elements.length > 1) {
          findings.push({
            rule: "duplicate-id",
            selector: `#${CSS.escape(id)}`,
            message: `ID "${id}" is used ${elements.length} times.`,
          });
        }
      });

      document.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"]',
      ).forEach((element) => {
        if (!isVisible(element)) return;

        if (!accessibleName(element)) {
          findings.push({
            rule: "interactive-name",
            selector: selectorFor(element),
            message: "Visible interactive element has no accessible name.",
          });
        }
      });

      document
        .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]), select, textarea',
        )
        .forEach((element) => {
          if (!isVisible(element)) return;

          const hasLabel =
            Boolean(element.getAttribute("aria-label")?.trim()) ||
            Boolean(textFromIds(element.getAttribute("aria-labelledby"))) ||
            Boolean(element.labels?.length);

          if (!hasLabel) {
            findings.push({
              rule: "form-label",
              selector: selectorFor(element),
              message: "Visible form control is not associated with a label.",
            });
          }
        });

      document.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        if (!image.hasAttribute("alt")) {
          findings.push({
            rule: "image-alt",
            selector: selectorFor(image),
            message: "Image is missing an alt attribute.",
          });
        }
      });

      document.querySelectorAll<HTMLElement>("[tabindex]").forEach((element) => {
        const value = Number(element.getAttribute("tabindex"));
        if (Number.isFinite(value) && value > 0) {
          findings.push({
            rule: "positive-tabindex",
            selector: selectorFor(element),
            message: "Positive tabindex changes the natural keyboard order.",
          });
        }
      });

      document
        .querySelectorAll<HTMLElement>('[aria-hidden="true"]')
        .forEach((element) => {
          const focusable = element.querySelector<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          if (focusable && isVisible(focusable)) {
            findings.push({
              rule: "aria-hidden-focus",
              selector: selectorFor(element),
              message: "aria-hidden content contains a visible focusable control.",
            });
          }
        });

      document.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((dialog) => {
        if (!isVisible(dialog)) return;

        const hasName =
          Boolean(dialog.getAttribute("aria-label")?.trim()) ||
          Boolean(textFromIds(dialog.getAttribute("aria-labelledby")));

        if (!hasName) {
          findings.push({
            rule: "dialog-name",
            selector: selectorFor(dialog),
            message: "Visible dialog has no accessible name.",
          });
        }

        if (dialog.getAttribute("aria-modal") !== "true") {
          findings.push({
            rule: "dialog-modal",
            selector: selectorFor(dialog),
            message: 'Visible dialog should declare aria-modal="true".',
          });
        }
      });

      document
        .querySelectorAll<HTMLElement>("button a[href], a[href] button")
        .forEach((element) => {
          if (!isVisible(element)) return;
          findings.push({
            rule: "nested-interactive",
            selector: selectorFor(element),
            message: "Interactive controls must not be nested.",
          });
        });

      if (shouldRequireMain) {
        const visibleMain = Array.from(document.querySelectorAll("main")).filter(
          isVisible,
        );

        if (visibleMain.length !== 1) {
          findings.push({
            rule: "main-landmark",
            selector: "main",
            message: `Expected one visible main landmark, found ${visibleMain.length}.`,
          });
        }
      }

      if (shouldRequireSkipLink) {
        const skipLink = document.querySelector<HTMLAnchorElement>("#skip-link");
        const targetId = skipLink?.getAttribute("href")?.replace(/^#/, "") || "";
        const target = targetId ? document.getElementById(targetId) : null;

        if (!skipLink || !target) {
          findings.push({
            rule: "skip-link",
            selector: "#skip-link",
            message: "Skip link or its target is missing.",
          });
        }
      }

      if (!document.title.trim()) {
        findings.push({
          rule: "document-title",
          selector: "head > title",
          message: "Document title is empty.",
        });
      }

      return findings.slice(0, 30);
    },
    {
      shouldRequireMain: requireMain,
      shouldRequireSkipLink: requireSkipLink,
    },
  );

  expect(
    issues,
    `baseline accessibility issues: ${JSON.stringify(issues)}`,
  ).toEqual([]);
}

export async function expectSkipLinkKeyboardAccess(page: Page): Promise<void> {
  const skipLink = page.locator("#skip-link");
  await expect(skipLink).toHaveCount(1);

  /*
   * A pointer click inside the application changes Chromium's sequential-focus
   * starting point and can legitimately skip controls that appear earlier in
   * DOM order. Focus a temporary, programmatically focusable body instead so a
   * real Tab key starts at the beginning of the document.
   */
  const previousBodyTabIndex = await page.evaluate(() => {
    const body = document.body;
    const previous = body.getAttribute("tabindex");

    body.setAttribute("tabindex", "-1");
    body.focus({ preventScroll: true });

    return previous;
  });

  try {
    await page.keyboard.press("Tab");

    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    /*
     * The production skip link has a short reveal transition. Poll its final
     * geometry rather than sampling an intermediate translated position.
     */
    await expect
      .poll(async () => {
        const bounds = await skipLink.boundingBox();
        return Boolean(bounds && bounds.x >= 0 && bounds.y >= 0);
      }, {
        message: "Focused skip link should be fully inside the viewport.",
      })
      .toBe(true);
  } finally {
    await page.evaluate((previous) => {
      if (previous === null) {
        document.body.removeAttribute("tabindex");
      } else {
        document.body.setAttribute("tabindex", previous);
      }
    }, previousBodyTabIndex);
  }
}

export async function expectMinimumTouchTargets(
  page: Page,
  minimum = 24,
): Promise<void> {
  const undersized = await page.evaluate((targetSize) => {
    const viewport = document.documentElement.clientWidth;

    return Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), select, textarea',
      ),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right >= 0 &&
          rect.left <= viewport
        );
      })
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (element.matches("p a, li a")) return false;
        if (element instanceof HTMLAnchorElement && style.display === "inline") {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width < targetSize || rect.height < targetSize;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
            element.tagName,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        };
      })
      .slice(0, 20);
  }, minimum);

  expect(
    undersized,
    `touch targets smaller than ${minimum}px: ${JSON.stringify(undersized)}`,
  ).toEqual([]);
}
