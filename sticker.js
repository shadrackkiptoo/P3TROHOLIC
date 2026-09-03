const sharp = require('sharp');

module.exports = async function toWebp(buffer) {
  return sharp(buffer)
    .resize(512, 512, { fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer();
};
