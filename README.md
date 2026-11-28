# Stuff I want

Run `node build.mjs` with Node 24 to build the static site. Open `dist/index.html` in a browser to preview it.

## Edit the wishlist

Edit [wishlist-draft.json](wishlist-draft.json). Each object in `items` is one entry. Search by title or ID to find it again.

- Add a unique `id`, a `title` and a `category` to show an entry. Use one of the existing categories or give a new one a name. Set `preview` to `false` to keep an entry out of the preview.
- Add a product `url`, the exact `variant`, and `notes` if needed. To show a second shop, add an `alternateShop` object with its `name` and `url`.
- Use `priceGBP` for a guide price and `priceSource` for its source. Use `amountsGBP` for a gift card with fixed amounts. Leave prices blank until you have a figure. Set `suggest` to `false` for items that need a decision before someone can buy them.
- Put images in [assets/images](assets/images). Set `image.file` to the file name and record the original product photo URL as `image.sourceUrl`. For an illustration, set `image.kind` to `generated`. The site adds the label.
- Set `featured` to 1, 2 or 3 to place an item in the opening gallery.

Run `npm run build` to check your changes. Open a pull request, then merge it into `main` when the build passes. Cloudflare builds the static site at [wishlist.wiskow.cc](https://wishlist.wiskow.cc/).
