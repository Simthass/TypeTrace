import { expect, type Page } from "@playwright/test";

interface OverflowSnapshot {
  bodyClientWidth: number;
  bodyScrollWidth: number;
  documentClientWidth: number;
  documentScrollWidth: number;
  suspects: Array<{
    element: string;
    label: string;
    left: number;
    right: number;
    width: number;
    clientWidth: number;
    scrollWidth: number;
    overflowX: string;
  }>;
}

async function readOverflowSnapshot(page: Page): Promise<OverflowSnapshot> {
  return page.evaluate(() => {
    const documentElement = document.documentElement;
    const viewportWidth = documentElement.clientWidth;

    const suspects = Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          (rect.left < -1 ||
            rect.right > viewportWidth + 1 ||
            element.scrollWidth > element.clientWidth + 1)
        );
      })
      .map((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return {
          element: element.tagName.toLowerCase(),
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
            element.className?.toString().slice(0, 80) ||
            element.tagName,
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX,
        };
      })
      .sort(
        (left, right) =>
          Math.max(
            right.right - viewportWidth,
            right.scrollWidth - right.clientWidth,
          ) -
          Math.max(
            left.right - viewportWidth,
            left.scrollWidth - left.clientWidth,
          ),
      )
      .slice(0, 10);

    return {
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth,
      suspects,
    };
  });
}

export async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const snapshot = await readOverflowSnapshot(page);

  expect(
    snapshot.documentScrollWidth,
    `document overflowed horizontally: ${JSON.stringify(snapshot)}`,
  ).toBeLessThanOrEqual(snapshot.documentClientWidth + 1);

  expect(
    snapshot.bodyScrollWidth,
    `body overflowed horizontally: ${JSON.stringify(snapshot)}`,
  ).toBeLessThanOrEqual(snapshot.bodyClientWidth + 1);
}

export async function expectViewportContained(page: Page): Promise<void> {
  await expectNoDocumentOverflow(page);

  const clippedInteractiveElements = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;

    return Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a[href], input, select, textarea",
      ),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim().slice(0, 80) ||
            element.tagName,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      })
      .filter(
        (item) =>
          item.width > 0 &&
          (item.left < -1 || item.right > viewportWidth + 1),
      )
      .slice(0, 10);
  });

  expect(
    clippedInteractiveElements,
    `interactive elements escaped the viewport: ${JSON.stringify(clippedInteractiveElements)}`,
  ).toEqual([]);
}
