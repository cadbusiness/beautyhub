import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

/// Couleur d'accent d'un RDV = couleur du praticien, fallback prestation,
/// fallback un violet neutre.
Color agendaAccentColor(DayAppointment appointment) {
  final staff = _parseHex(appointment.staffColor);
  if (staff != null) return staff;
  final service = _parseHex(appointment.serviceColor);
  if (service != null) return service;
  return const Color(0xFF64748B);
}

/// Fond pastel dérivé d'une couleur d'accent (transparence forte).
Color agendaPastel(Color accent, {double opacity = 0.16}) {
  return accent.withValues(alpha: opacity);
}

Color? _parseHex(String? raw) {
  if (raw == null) return null;
  var hex = raw.trim();
  if (hex.isEmpty) return null;
  if (hex.startsWith('#')) hex = hex.substring(1);
  if (hex.length == 3) {
    hex = hex.split('').map((c) => '$c$c').join();
  }
  if (hex.length != 6) return null;
  final value = int.tryParse(hex, radix: 16);
  if (value == null) return null;
  return Color(0xFF000000 | value);
}
