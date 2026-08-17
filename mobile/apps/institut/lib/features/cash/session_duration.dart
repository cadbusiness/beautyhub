import 'package:intl/intl.dart';

String formatSessionElapsed(DateTime openedAt, {DateTime? now}) {
  final elapsed = (now ?? DateTime.now()).difference(openedAt);
  if (elapsed.isNegative || elapsed.inSeconds < 45) return 'à l’instant';
  final days = elapsed.inDays;
  final hours = elapsed.inHours;
  final mins = elapsed.inMinutes.remainder(60);
  if (days >= 1) {
    final remainHours = elapsed.inHours.remainder(24);
    final dayLabel = days == 1 ? '1 jour' : '$days jours';
    if (remainHours == 0) return dayLabel;
    return '$dayLabel $remainHours h';
  }
  if (hours >= 1) {
    if (mins == 0) return '$hours h';
    return '$hours h ${mins.toString().padLeft(2, '0')} min';
  }
  return mins == 1 ? '1 min' : '$mins min';
}

String sessionOpenedCaption({
  required DateTime openedAt,
  required bool previousDay,
  required bool paused,
  DateTime? now,
}) {
  final start = DateFormat.Hm().format(openedAt);
  final elapsed = formatSessionElapsed(openedAt, now: now);
  if (previousDay) {
    return paused
        ? 'En pause · ouverte un jour précédent · début $start'
        : 'Ouverte un jour précédent · début $start';
  }
  if (paused) return 'En pause depuis $elapsed · début $start';
  return 'Ouverte depuis $elapsed · début $start';
}
