# Stuff I want

Run `node build.mjs` with Node 24 to build the static site. Open `dist/index.html` in a browser to preview it.

## Add an item from a link

1. Run `npm ci` the first time, then `npm run add-item`.
2. Open [the editor](http://127.0.0.1:4181/) and paste a product link. Check the name, price and photo. Set a category and correct any details. You can preview another photo link, upload a photo, or leave the photo blank.
3. Select **Save item locally**. Run `npm run build` to check the result. Commit the list and any new image, then push to `main`. GitHub Actions publishes the static build to [GitHub Pages](https://samwiskow.github.io/stuff-i-want/).

The editor runs on your computer. It reads the product details that shops expose on their pages. If a shop blocks the lookup, you can enter the details manually. The importer leaves the price blank when it cannot identify a price in pounds.

An agent can run `npm run add-item -- --inspect 'PRODUCT_URL'` to read the same draft details as JSON before it edits the list.

## Edit the list directly

Edit [wishlist-draft.json](wishlist-draft.json). Each object in `items` is one entry. Search by title or ID to find it again.

- Add a `title` and `category` to show an entry in the preview. Use one of the existing categories or give a new one a name. Set `preview` to `false` to keep an entry out of the preview.
- Add a product `url`, the exact `variant`, and `notes` if needed.
- Use `priceGBP` for a guide price and `priceSource` for its source. Use `amountsGBP` for a gift card with fixed amounts. Leave prices blank until you have a figure. Set `suggest` to `false` for items that need a decision before someone can buy them.
- Put images in [assets/images](assets/images). Set `image.file` to the file name and record the original product photo URL as `image.sourceUrl`. For an illustration, set `image.kind` to `generated`. The site adds the label.
- Set `featured` to 1, 2 or 3 to place an item in the opening gallery.

Run the build again after changes. Only the contents of `dist` are needed for static hosting.
