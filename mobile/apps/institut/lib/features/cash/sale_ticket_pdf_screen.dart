import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';

import '../../state/session_providers.dart';
import '../shared/sale_doc.dart';

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

Future<void> openSaleDocumentPdf(
  BuildContext context, {
  required String documentId,
  String? title,
  String? docType,
}) {
  return Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(
      builder: (_) => SaleTicketPdfScreen(
        documentId: documentId,
        title: title,
        docType: docType,
      ),
    ),
  );
}

class SaleTicketPdfScreen extends ConsumerStatefulWidget {
  const SaleTicketPdfScreen({
    super.key,
    this.saleId,
    this.documentId,
    this.title,
    this.docType,
  }) : assert(saleId != null || documentId != null);

  final String? saleId;
  final String? documentId;
  final String? title;
  final String? docType;

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
      final bytes = widget.documentId != null
          ? await ref.read(mobileApiProvider).fetchSaleDocumentPdf(
                accessToken: token,
                tenantId: tenantId,
                documentId: widget.documentId!,
              )
          : await ref.read(mobileApiProvider).fetchSaleTicketPdf(
                accessToken: token,
                tenantId: tenantId,
                saleId: widget.saleId!,
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
        : (widget.documentId != null ? 'Document' : 'Ticket');
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: Row(
          children: [
            SaleDocMark(
              docType: widget.docType ??
                  (widget.saleId != null ? 'ticket' : 'invoice'),
              size: 28,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
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
      return const Center(child: Text('PDF indisponible.'));
    }
    return PdfPreview(
      build: (_) async => bytes,
      pdfFileName: '${widget.title ?? 'document'}.pdf',
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
