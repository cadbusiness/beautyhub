import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';

import '../../state/session_providers.dart';

Future<void> openSaleTicketPdf(
  BuildContext context, {
  required String saleId,
  String? title,
}) {
  return Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(
      builder: (_) => SaleTicketPdfScreen(saleId: saleId, title: title),
    ),
  );
}

class SaleTicketPdfScreen extends ConsumerStatefulWidget {
  const SaleTicketPdfScreen({
    super.key,
    required this.saleId,
    this.title,
  });

  final String saleId;
  final String? title;

  @override
  ConsumerState<SaleTicketPdfScreen> createState() =>
      _SaleTicketPdfScreenState();
}

class _SaleTicketPdfScreenState extends ConsumerState<SaleTicketPdfScreen> {
  Uint8List? _bytes;
  Object? _error;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) {
        throw StateError('Session ou institut manquant');
      }
      final bytes = await ref.read(mobileApiProvider).fetchSaleTicketPdf(
            accessToken: token,
            tenantId: tenantId,
            saleId: widget.saleId,
          );
      if (!mounted) return;
      setState(() {
        _bytes = bytes;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.title?.isNotEmpty == true
        ? widget.title!
        : 'Ticket';
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: Text(title),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0A0A0A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$_error',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF525252)),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _load,
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      );
    }
    final bytes = _bytes;
    if (bytes == null || bytes.isEmpty) {
      return const Center(child: Text('Ticket indisponible.'));
    }
    return PdfPreview(
      build: (_) async => bytes,
      pdfFileName: '${widget.title ?? 'ticket'}.pdf',
      canChangeOrientation: false,
      canChangePageFormat: false,
      canDebug: false,
      allowPrinting: true,
      allowSharing: true,
      useActions: true,
      scrollViewDecoration: const BoxDecoration(color: Color(0xFFF5F5F5)),
      pdfPreviewPageDecoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
    );
  }
}
