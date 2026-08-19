import 'package:beautyhub_core/beautyhub_core.dart';

final _trailingDuration = RegExp(
  r"""(?:\s*[·•\-–]\s*)?\d+\s*(?:['′’]|min)\s*$""",
  caseSensitive: false,
);

String stripDurationFromService(String name) {
  return name.replaceFirst(_trailingDuration, '').trim();
}

String liveCountdownLabel(DateTime startsAt, {DateTime? now}) {
  final diff = startsAt.difference(now ?? DateTime.now());
  if (diff.inSeconds <= 0) return 'Maintenant';
  final hours = diff.inHours;
  final minutes = diff.inMinutes.remainder(60);
  final seconds = diff.inSeconds.remainder(60);
  if (hours >= 1) {
    return minutes > 0 ? 'Dans $hours h $minutes min' : 'Dans $hours h';
  }
  if (minutes >= 1) return 'Dans $minutes min $seconds s';
  return 'Dans $seconds s';
}

String appointmentServiceLine(DayAppointment appointment) {
  final name = stripDurationFromService(appointment.serviceName);
  final duration = appointment.durationLabel;
  if (name.isEmpty) return duration;
  if (duration.isEmpty) return name;
  return '$name · $duration';
}

String shortCabinLabel(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return trimmed;
  final trailingNum = RegExp(r'(\d+)\s*$').firstMatch(trimmed);
  if (trailingNum != null) return trailingNum.group(1)!;
  final words = trimmed.split(RegExp(r'\s+'));
  if (words.length > 1 && words.last.length <= 3) return words.last;
  if (words.length > 1) {
    final letters = words
        .where((w) => w.isNotEmpty)
        .map((w) => w.substring(0, 1).toUpperCase())
        .take(2)
        .join();
    if (letters.isNotEmpty) return letters;
  }
  if (trimmed.length <= 2) return trimmed;
  return trimmed.substring(0, 2);
}

int cabinToneValue(String label) {
  var hash = 0;
  for (final unit in label.codeUnits) {
    hash = 0x1fffffff & (hash + unit);
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    hash ^= hash >> 6;
  }
  const palette = [
    0xFF1E3A5F,
    0xFF3D5A3D,
    0xFF6B3E26,
    0xFF4A3F6B,
    0xFF1F4E5F,
    0xFF5C3D2E,
  ];
  return palette[hash.abs() % palette.length];
}
