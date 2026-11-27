const lookup = document.getElementById('lookup');
const review = document.getElementById('review');
const fields = review.elements;
const lookupStatus = document.getElementById('lookup-status');
const saveStatus = document.getElementById('save-status');
const photoStatus = document.getElementById('photo-status');
const preview = document.getElementById('preview');
const photoButton = document.getElementById('preview-link');
const saveButton = review.querySelector('[type="submit"]');
let photo;

async function api(path, data) {
  const response = await fetch(path, data === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function clearPhoto() {
  photo = undefined;
  preview.hidden = true;
  preview.removeAttribute('src');
  document.getElementById('no-photo').hidden = false;
  photoStatus.textContent = '';
}

async function showPhoto(result, message) {
  preview.src = result.preview;
  await preview.decode();
  photo = result;
  preview.hidden = false;
  document.getElementById('no-photo').hidden = true;
  photoStatus.textContent = message;
}

async function previewLink() {
  const url = fields.photoUrl.value.trim();
  clearPhoto();
  if (!url) return;
  photoStatus.textContent = 'Loading photo…';
  photoButton.disabled = true;
  saveButton.disabled = true;
  try {
    const result = await api('/photo', { url });
    if (fields.photoUrl.value.trim() !== url) return;
    await showPhoto(result, 'Check that the photo shows the right variant.');
  } catch {
    photoStatus.textContent = 'The photo did not load. Try another photo link, choose a file, or remove the photo.';
  } finally {
    photoButton.disabled = false;
    saveButton.disabled = false;
  }
}

api('/categories').then(({ categories }) => {
  const options = categories.map(category => Object.assign(document.createElement('option'), { value: category }));
  document.getElementById('categories').replaceChildren(...options);
}).catch(() => {});

lookup.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = lookup.querySelector('button');
  submit.disabled = true;
  review.hidden = true;
  lookupStatus.textContent = 'Looking up the product…';
  review.reset();
  clearPhoto();
  saveStatus.textContent = '';
  const url = lookup.elements.url.value.trim();
  fields.url.value = url;
  try {
    const data = await api('/inspect', { url });
    fields.url.value = data.url;
    fields.title.value = data.title;
    fields.price.value = data.priceGBP ?? '';
    fields.photoUrl.value = data.imageUrl;
    lookupStatus.textContent = data.note || 'Check the details and choose a category.';
    review.hidden = false;
    if (data.imageUrl) await previewLink();
  } catch (error) {
    lookupStatus.textContent = `${error.message} You can enter the details below.`;
    review.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

fields.photoUrl.addEventListener('input', () => {
  clearPhoto();
  fields.photoFile.value = '';
  if (fields.photoUrl.value.trim()) photoStatus.textContent = 'Preview the new photo before saving.';
});
photoButton.addEventListener('click', previewLink);
document.getElementById('remove-photo').addEventListener('click', () => {
  fields.photoUrl.value = '';
  fields.photoFile.value = '';
  clearPhoto();
});
fields.photoFile.addEventListener('change', async () => {
  const file = fields.photoFile.files[0];
  if (!file) return;
  fields.photoUrl.value = '';
  clearPhoto();
  saveButton.disabled = true;
  try {
    if (file.size > 4 * 1024 * 1024 || !/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
      throw new Error('Use a JPEG, PNG, WebP, GIF or AVIF image, up to 4 MB.');
    }
    const reader = new FileReader();
    const data = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await showPhoto({ preview: data }, 'Check the photo before you save.');
  } catch (error) {
    photoStatus.textContent = error.message || 'The photo did not load.';
  } finally {
    saveButton.disabled = false;
  }
});

review.addEventListener('submit', async event => {
  event.preventDefault();
  if ((fields.photoUrl.value.trim() || fields.photoFile.files.length) && !photo) {
    saveStatus.textContent = 'Preview or remove the photo before you save.';
    return;
  }
  saveButton.disabled = true;
  saveStatus.textContent = 'Saving…';
  try {
    const { item } = await api('/save', {
      url: fields.url.value, title: fields.title.value, category: fields.category.value,
      price: fields.price.value, variant: fields.variant.value, notes: fields.notes.value,
      suggest: fields.suggest.checked, generated: fields.generated.checked, photo: photo?.preview, photoSource: photo?.sourceUrl
    });
    review.hidden = true;
    lookup.reset();
    lookupStatus.textContent = `Saved “${item.title}” locally. Commit and push the changes to publish it.`;
    lookup.elements.url.focus();
  } catch (error) {
    saveStatus.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});
