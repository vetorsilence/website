#!/bin/bash

rm -rf $1/Out
mkdir -p $1/Out
mkdir -p $1/Out/Thumbs
mkdir -p $1/Out/Previews
mkdir -p $1/Out/Posters

yaml=""
index=-1

media_bucket="nunciato-media"

for file in $1/*.*
do
  ((index++))

  echo ""
  echo "-------------------- Item $index ---------------------"
  echo ""

  path=$(dirname $file)
  filename=$(basename -- "$file")
  extension_raw="${filename##*.}"
  extension="$(echo $extension_raw | tr '[:upper:]' '[:lower:]')"
  filename="${filename%.*}"
  target_filename=""
  new_extension=""
  new_filename=""
  new_filepath=""
  new_thumbname=""
  new_thumbpath=""
  folder=""
  type=""
  title=""
  caption=""
  options=""
  tags=""

  thumbnail_width="320"
  preview_width="800"
  video_width="1600"

  # Extract the raw creation date, which should be common to all exports (2018:04:21 16:32:35.00).
  # Here, we privilege CreateDate, and if that doesn't exist, we fall back to DateCreated.
  exif_create_date="$(exiftool -s -s -s -CreateDate -DateCreated $file | head -1)"
  hugo_formatted_date="${exif_create_date:0:4}-${exif_create_date:5:2}-${exif_create_date:8:2}${exif_create_date:10:9}"

  # Extract title and caption
  title="$(exiftool -s -s -s -Title $file)"
  caption="$(exiftool -s -s -s -Description $file)"

  # Extract some useful EXIF data
  exif_make="$(exiftool -s -s -s -Make $file)"
  exif_model="$(exiftool -s -s -s -Model $file)"
  exif_lens="$(exiftool -s -s -s -LensModel $file)"
  exif_iso="$(exiftool -s -s -s -ISO $file)"
  exif_aperture="$(exiftool -s -s -s -ApertureValue $file)"
  exif_shutter_speed="$(exiftool -s -s -s -ShutterSpeed $file)"
  exif_focal_length="$(exiftool -s -s -s -FocalLength $file)"

  # Extract tags, which may or may not be present
  tags_string="$(exiftool -s -s -s -Subject $file)"
  IFS=', ' read -r -a tags_array <<< "$tags_string"
  if [ ${#tags_array[@]} -eq 0 ]; then
    echo "No tags."
  else
    tags="
  tags:"
    for tag in "${tags_array[@]}"
    do
      tags="$tags
    - $tag"
    done
  fi

  # Set a target filename based on that date (2018-04-21-16-32-35-00)
  target_filename="$(echo $exif_create_date | sed -e 's/[: \.]/-/g')"

  # # # # # # # # # # # #
  # Photos              #
  # # # # # # # # # # # #

  if [ "$extension" = "jpg" ]; then
    new_extension="jpg"
    new_filename="$target_filename.$new_extension"
    new_filepath="$path/Out/$new_filename"
    new_previewname="$new_filename"
    new_previewpath="$path/Out/Previews/$new_previewname"
    new_thumbname="$new_filename"
    new_thumbpath="$path/Out/Thumbs/$new_thumbname"
    folder="images"
    type="photo"

    # Values range from 1 to 31, where lower means mo' betta.
    # https://superuser.com/questions/318845/improve-quality-of-ffmpeg-created-jpgs
    ffmpeg -i "$file" -vf scale=$video_width:-1 -pix_fmt yuvj422p -q:v 4 -y "$new_filepath"

    # Preview
    ffmpeg -i "$file" -vf scale=$preview_width:-1 -pix_fmt yuvj422p -q:v 4 -y "$new_previewpath"

    # Thumbnail
    ffmpeg -i "$file" -vf scale=$thumbnail_width:-1 -pix_fmt yuvj422p -q:v 1 -y "$new_thumbpath"
  fi

  # # # # # # # # # # # #
  # Videos              #
  # # # # # # # # # # # #

  if [ "$extension" = "mov" ] || [ "$extension" = "mp4" ]; then
    new_extension="mp4"
    new_filename="$target_filename.$new_extension"
    new_filepath="$path/Out/$new_filename"
    new_previewname="$target_filename.jpg"
    new_previewpath="$path/Out/Previews/$new_previewname"
    new_thumbname="$target_filename.jpg"
    new_thumbpath="$path/Out/Thumbs/$new_thumbname"
    new_postername="$target_filename.jpg"
    new_posterpath="$path/Out/Posters/$new_postername"
    folder="video"
    type="video"
    options="
  controls: true"

    duration="$(ffprobe -i "$file" -show_entries stream=codec_type,duration -of compact=p=0:nk=1 | head -1 | sed -e 's/video|//g')"
    duration_minus_one="$(echo $duration-1|bc)"
    options="$options
  duration: ${duration%.*}"

    ffmpeg -i "$file" -vf "fade=in:0:30,fade=out:st=$duration_minus_one:d=1,scale=$video_width:-1" -af "afade=in:st=0:d=1,afade=out:st=$duration_minus_one:d=1" -vcodec h264 -acodec aac -strict -2 "$new_filepath"

    # Preview
    ffmpeg -i "$file" -vf "select=gte(n\,100),scale=$preview_width:-1" -vframes 2 "$new_previewpath"

    # Thumbnail
    ffmpeg -i "$file" -vf "select=gte(n\,100),scale=$thumbnail_width:-1" -vframes 1 "$new_thumbpath"

    # Poster
    ffmpeg -i "$file" -vf "select=gte(n\,100),scale=$video_width:-1" -vframes 1 "$new_posterpath"

    options="$options
  poster: 's3/posters/${new_postername}'"
  fi

  # # # # # # # # # # # #
  # Common              #
  # # # # # # # # # # # #

  # Burn the tags from the old file into the new
  exiftool -overwrite_original_in_place -tagsFromFile "$file" "$new_filepath"

  # Copy the new file to S3
  aws s3 cp "$new_filepath" "s3://$media_bucket/$folder/$new_filename" --profile personal

  # Assuming we got a preview, copy that, too
  if [ ! -z "$new_previewpath" ]; then
    aws s3 cp "$new_previewpath" "s3://$media_bucket/previews/$new_previewname" --profile personal
  fi

  # Assuming we got a thumb, copy that, too
  if [ ! -z "$new_thumbpath" ]; then
    aws s3 cp "$new_thumbpath" "s3://$media_bucket/thumbs/$new_thumbname" --profile personal
  fi

  # Assuming we got a poster, copy that, too
  if [ ! -z "$new_posterpath" ]; then
    aws s3 cp "$new_posterpath" "s3://$media_bucket/posters/$new_postername" --profile personal
  fi

  # Assemble the YAML
  yaml="$yaml
- type: ${type}
  url: 's3/${folder}/${new_filename}'
  preview: 's3/previews/${new_previewname}'
  thumb: 's3/thumbs/${new_thumbname}'
  created: ${hugo_formatted_date}
  exif:
    make: '${exif_make}'
    model: '${exif_model}'
    lens: '${exif_lens}'
    iso: '${exif_iso}'
    aperture: '${exif_aperture}'
    shutter_speed: '${exif_shutter_speed}'
    focal_length: '${exif_focal_length}'
  title: '${title}'
  caption: '${caption}' ${options} ${tags}"
done

printf "$yaml
"
