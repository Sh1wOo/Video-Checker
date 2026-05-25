use anyhow::{anyhow, Context, Result};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

pub fn probe_duration(path: &Path) -> Result<f64> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "mp4" | "mov" | "m4v" => parse_mp4_duration(path),
        "mkv" | "webm" => parse_mkv_duration(path),
        "avi" => parse_avi_duration(path),
        "wmv" | "flv" | "mpg" | "mpeg" => Err(anyhow!("Формат пока не реализован: {}", ext)),
        _ => Err(anyhow!("Неподдерживаемый формат: {}", ext)),
    }
}

pub fn parse_mp4_duration(path: &Path) -> Result<f64> {
    let mut file = File::open(path)
        .with_context(|| format!("Не удалось открыть файл: {}", path.display()))?;
    let len = file.metadata()?.len();
    parse_mp4_boxes(&mut file, len)
}

fn parse_mp4_boxes(file: &mut File, end: u64) -> Result<f64> {
    let mut pos = file.stream_position()?;
    while pos + 8 <= end {
        file.seek(SeekFrom::Start(pos))?;
        let size = read_u32_be(file)? as u64;
        let mut typ = [0u8; 4];
        file.read_exact(&mut typ)?;

        let (box_size, header) = if size == 1 {
            (read_u64_be(file)?, 16)
        } else if size == 0 {
            (end - pos, 8)
        } else {
            (size, 8)
        };

        if box_size < header || pos + box_size > end {
            break;
        }

        if &typ == b"moov" {
            return parse_moov(file, pos + header, pos + box_size);
        }

        pos += box_size;
    }

    Err(anyhow!("Не найден atom moov/mvhd"))
}

fn parse_moov(file: &mut File, start: u64, end: u64) -> Result<f64> {
    let mut pos = start;
    while pos + 8 <= end {
        file.seek(SeekFrom::Start(pos))?;
        let size = read_u32_be(file)? as u64;
        let mut typ = [0u8; 4];
        file.read_exact(&mut typ)?;

        let (box_size, header) = if size == 1 {
            (read_u64_be(file)?, 16)
        } else if size == 0 {
            (end - pos, 8)
        } else {
            (size, 8)
        };

        if box_size < header || pos + box_size > end {
            break;
        }

        if &typ == b"mvhd" {
            file.seek(SeekFrom::Start(pos + header))?;
            let version = read_u8(file)?;
            let mut flags = [0u8; 3];
            file.read_exact(&mut flags)?;

            if version == 1 {
                skip(file, 16)?;
                let timescale = read_u32_be(file)? as f64;
                let duration = read_u64_be(file)? as f64;
                if timescale > 0.0 {
                    return Ok(duration / timescale);
                }
            } else {
                skip(file, 8)?;
                let timescale = read_u32_be(file)? as f64;
                let duration = read_u32_be(file)? as f64;
                if timescale > 0.0 {
                    return Ok(duration / timescale);
                }
            }
        }

        pos += box_size;
    }

    Err(anyhow!("Не найден atom mvhd"))
}

pub fn parse_avi_duration(path: &Path) -> Result<f64> {
    let mut file = File::open(path)
        .with_context(|| format!("Не удалось открыть файл: {}", path.display()))?;

    let mut riff = [0u8; 4];
    file.read_exact(&mut riff)?;
    if &riff != b"RIFF" {
        return Err(anyhow!("AVI: нет RIFF заголовка"));
    }

    let _riff_size = read_u32_le(&mut file)?;
    let mut avi = [0u8; 4];
    file.read_exact(&mut avi)?;
    if &avi != b"AVI " {
        return Err(anyhow!("AVI: нет AVI сигнатуры"));
    }

    let file_len = file.metadata()?.len();
    let mut pos = 12u64;

    while pos + 8 <= file_len {
        file.seek(SeekFrom::Start(pos))?;
        let mut chunk_id = [0u8; 4];
        if file.read_exact(&mut chunk_id).is_err() {
            break;
        }
        let chunk_size = read_u32_le(&mut file)? as u64;

        if &chunk_id == b"LIST" {
            let mut list_type = [0u8; 4];
            file.read_exact(&mut list_type)?;
            if &list_type == b"hdrl" {
                if let Ok(dur) = parse_avi_hdrl(&mut file, pos + 12, pos + 8 + chunk_size) {
                    return Ok(dur);
                }
            }
        }

        pos += 8 + align2(chunk_size);
    }

    Err(anyhow!("AVI: не найден avih"))
}

fn parse_avi_hdrl(file: &mut File, start: u64, end: u64) -> Result<f64> {
    let mut pos = start;
    while pos + 8 <= end {
        file.seek(SeekFrom::Start(pos))?;
        let mut chunk_id = [0u8; 4];
        file.read_exact(&mut chunk_id)?;
        let chunk_size = read_u32_le(file)? as u64;

        if &chunk_id == b"avih" {
            let microsec_per_frame = read_u32_le(file)? as f64;
            let _max_bytes_per_sec = read_u32_le(file)?;
            let _padding = read_u32_le(file)?;
            let _flags = read_u32_le(file)?;
            let total_frames = read_u32_le(file)? as f64;
            if microsec_per_frame > 0.0 && total_frames > 0.0 {
                return Ok((microsec_per_frame * total_frames) / 1_000_000.0);
            }
        }

        pos += 8 + align2(chunk_size);
    }

    Err(anyhow!("AVI hdrl: не найден avih"))
}

pub fn parse_mkv_duration(path: &Path) -> Result<f64> {
    let mut file = File::open(path)
        .with_context(|| format!("Не удалось открыть файл: {}", path.display()))?;
    let len = file.metadata()?.len();

    let mut pos = 0u64;
    let mut info_start = None;
    let mut info_end = None;

    while pos < len {
        file.seek(SeekFrom::Start(pos))?;
        let (id, id_len) = read_ebml_id(&mut file)?;
        let (size, size_len) = read_ebml_size(&mut file)?;
        let data_start = pos + id_len as u64 + size_len as u64;
        let data_end = data_start.saturating_add(size);

        if id == 0x1549A966 {
            info_start = Some(data_start);
            info_end = Some(data_end.min(len));
            break;
        }

        if size == 0 || data_end <= pos {
            break;
        }
        pos = data_end;
    }

    let (start, end) = match (info_start, info_end) {
        (Some(s), Some(e)) => (s, e),
        _ => return Err(anyhow!("MKV: не найден Info")),
    };

    let mut timecode_scale = 1_000_000f64;
    let mut duration = None::<f64>;
    let mut pos = start;

    while pos < end {
        file.seek(SeekFrom::Start(pos))?;
        let (id, id_len) = read_ebml_id(&mut file)?;
        let (size, size_len) = read_ebml_size(&mut file)?;
        let data_start = pos + id_len as u64 + size_len as u64;
        let data_end = data_start.saturating_add(size);

        match id {
            0x2AD7B1 => {
                file.seek(SeekFrom::Start(data_start))?;
                timecode_scale = read_uint_be(&mut file, size)? as f64;
            }
            0x4489 => {
                file.seek(SeekFrom::Start(data_start))?;
                duration = Some(read_ebml_float(&mut file, size)?);
            }
            _ => {}
        }

        if size == 0 || data_end <= pos {
            break;
        }
        pos = data_end;
    }

    let duration_units = duration.ok_or_else(|| anyhow!("MKV: не найден Duration"))?;
    Ok(duration_units * (timecode_scale / 1_000_000_000.0))
}

fn read_ebml_id(file: &mut File) -> Result<(u64, usize)> {
    let first = read_u8(file)?;
    let width = vint_width(first).ok_or_else(|| anyhow!("EBML ID: invalid width"))?;
    let mut value = first as u64;
    for _ in 1..width {
        value = (value << 8) | read_u8(file)? as u64;
    }
    Ok((value, width))
}

fn read_ebml_size(file: &mut File) -> Result<(u64, usize)> {
    let first = read_u8(file)?;
    let width = vint_width(first).ok_or_else(|| anyhow!("EBML size: invalid width"))?;
    let mask = (1u8 << (8 - width)) - 1;
    let mut value = (first & mask) as u64;
    for _ in 1..width {
        value = (value << 8) | read_u8(file)? as u64;
    }
    Ok((value, width))
}

fn vint_width(first: u8) -> Option<usize> {
    for width in 1..=8 {
        if first & (1 << (8 - width)) != 0 {
            return Some(width);
        }
    }
    None
}

fn read_ebml_float(file: &mut File, size: u64) -> Result<f64> {
    match size {
        4 => {
            let mut buf = [0u8; 4];
            file.read_exact(&mut buf)?;
            Ok(f32::from_be_bytes(buf) as f64)
        }
        8 => {
            let mut buf = [0u8; 8];
            file.read_exact(&mut buf)?;
            Ok(f64::from_be_bytes(buf))
        }
        _ => Err(anyhow!("MKV Duration: unsupported float size {}", size)),
    }
}

fn read_uint_be(file: &mut File, size: u64) -> Result<u64> {
    if size == 0 || size > 8 {
        return Err(anyhow!("Invalid uint size {}", size));
    }
    let mut value = 0u64;
    for _ in 0..size {
        value = (value << 8) | read_u8(file)? as u64;
    }
    Ok(value)
}

fn read_u8(file: &mut File) -> Result<u8> {
    let mut buf = [0u8; 1];
    file.read_exact(&mut buf)?;
    Ok(buf[0])
}

fn read_u32_be(file: &mut File) -> Result<u32> {
    let mut buf = [0u8; 4];
    file.read_exact(&mut buf)?;
    Ok(u32::from_be_bytes(buf))
}

fn read_u64_be(file: &mut File) -> Result<u64> {
    let mut buf = [0u8; 8];
    file.read_exact(&mut buf)?;
    Ok(u64::from_be_bytes(buf))
}

fn read_u32_le(file: &mut File) -> Result<u32> {
    let mut buf = [0u8; 4];
    file.read_exact(&mut buf)?;
    Ok(u32::from_le_bytes(buf))
}

fn skip(file: &mut File, bytes: u64) -> Result<()> {
    file.seek(SeekFrom::Current(bytes as i64))?;
    Ok(())
}

fn align2(v: u64) -> u64 {
    if v % 2 == 0 { v } else { v + 1 }
}